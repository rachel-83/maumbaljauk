import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { callClaude } from '../lib/claude'
import SchoolEmotionChart from '../components/SchoolEmotionChart'
import WorryThread from '../components/WorryThread'

const MOOD_LABEL = { '😊': '기쁨', '😐': '보통', '😔': '슬픔', '😠': '분노', '😰': '불안' }

function formatTime(iso) {
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function anonHash(sid) {
  let h = 0
  for (let i = 0; i < sid.length; i++) h = ((h << 5) - h + sid.charCodeAt(i)) | 0
  return Math.abs(h).toString(16).slice(0, 6).padStart(6, '0')
}
function getDateNDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
function getISONDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}
function getMonthKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}
function getMonthLabel(key) {
  const [y, m] = key.split('-')
  return `${y}년 ${parseInt(m)}월`
}
function prevMonthKey(key) {
  const [y, m] = key.split('-').map(Number)
  return m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`
}
function nextMonthKey(key) {
  const [y, m] = key.split('-').map(Number)
  return m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`
}
function buildChart(diaries) {
  const moodCount = {}
  diaries.forEach(d => {
    moodCount[d.mood_emoji] = (moodCount[d.mood_emoji] ?? 0) + 1
  })
  return Object.entries(moodCount).map(([emoji, value]) => ({
    name: MOOD_LABEL[emoji] ?? '기타',
    emoji,
    value,
  }))
}

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [thisWeekData, setThisWeekData] = useState([])
  const [lastWeekData, setLastWeekData] = useState([])
  const [chartWeek, setChartWeek] = useState('this')
  const [activeStudents, setActiveStudents] = useState(0)
  const [worries, setWorries] = useState([])
  const [worryThread, setWorryThread] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [aiReport, setAiReport] = useState(null)   // null | 'loading' | 'empty' | { summary, topTags }
  const [aiReportLoading, setAiReportLoading] = useState(false)

  const schoolCode = profile?.school_code
  const myGrade    = profile?.grade
  const myClass    = profile?.class_num

  useEffect(() => {
    if (schoolCode) loadAll()
  }, [schoolCode])

  // 데이터 로드 후 가장 최근 월 자동 선택
  useEffect(() => {
    if (worries.length === 0) return
    const months = [...new Set(worries.map(w => getMonthKey(w.created_at)))].sort().reverse()
    if (!selectedMonth || !months.includes(selectedMonth)) {
      setSelectedMonth(months[0])
    }
  }, [worries])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadStats(), loadWorries()])
    setLoading(false)
    loadAIReport() // 메인 로딩 완료 후 비동기 실행 (자체 로딩 상태 관리)
  }

  // ── 감정 통계 (이번 주 + 지난 주) ───────────────────────────
  async function loadStats() {
    const thisWeekFrom = getDateNDaysAgo(7)
    const lastWeekFrom = getDateNDaysAgo(14)

    const { data: diaries } = await supabase
      .from('diary')
      .select('mood_emoji, user_id, grade, class_num, date')
      .eq('school_code', schoolCode)
      .gte('date', lastWeekFrom)

    const relevant = (diaries ?? []).filter(d =>
      (d.grade === myGrade && d.class_num === myClass) || d.grade == null
    )

    const thisWeek = relevant.filter(d => d.date >= thisWeekFrom)
    const lastWeek = relevant.filter(d => d.date >= lastWeekFrom && d.date < thisWeekFrom)

    setActiveStudents(new Set(thisWeek.map(d => d.user_id)).size)
    setThisWeekData(buildChart(thisWeek))
    setLastWeekData(buildChart(lastWeek))
  }

  // ── 고민 수신함 (RPC 사용 — 직접 쿼리는 RLS에 막힘) ──────────
  async function loadWorries() {
    const { data, error } = await supabase.rpc('get_teacher_worries')
    if (error) { console.error('get_teacher_worries:', error); setWorries([]); return }
    setWorries(data ?? [])
  }

  // ── AI 감정 리포트 ──────────────────────────────────────────
  async function loadAIReport() {
    setAiReportLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_class_emotion_tags')
      if (error) throw error

      if (!data || data.length === 0) { setAiReport('empty'); return }

      // 동일 태그 빈도 합산
      const tagMap = {}
      data.forEach(({ tag, cnt }) => { tagMap[tag] = (tagMap[tag] ?? 0) + Number(cnt) })

      const sorted = Object.entries(tagMap).sort((a, b) => b[1] - a[1])
      const topTags = sorted.slice(0, 3).map(([t]) => t)
      const tagSummary = sorted.slice(0, 10).map(([t, c]) => `${t}: ${c}회`).join(', ')

      const systemPrompt = `초등/중학교 담임교사에게 보내는 학급 감정 분석 요약이야.
3문장 이내로 간결하게 작성해줘.
주요 감정 흐름, 특이사항, 교사가 취할 수 있는 행동 1가지를 포함해줘.
따뜻하고 전문적인 어조로.
마크다운, 번호 목록, 제목 없이 자연스러운 문장으로만 써줘.`

      const summary = await callClaude(
        systemPrompt,
        [{ role: 'user', content: `최근 7일 학급 감정 태그 빈도: ${tagSummary}` }],
        256
      )

      setAiReport({ summary, topTags })
    } catch (e) {
      console.error('AI report:', e)
      setAiReport('empty')
    } finally {
      setAiReportLoading(false)
    }
  }

  async function openWorry(worry) {
    const { data, error } = await supabase.rpc('get_worry_thread', { p_worry_id: worry.id })
    if (error) { console.error('get_worry_thread:', error); return }
    setWorryThread({ ...worry, ...data, messages: data?.messages ?? [] })
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="text-4xl animate-bounce">👩‍🏫</div>
      </div>
    )
  }

  // ── 고민 스레드 상세 ──────────────────────────────────────
  if (worryThread) {
    async function handleTeacherReply(content, replyToId) {
      const { error } = await supabase.rpc('reply_to_worry', {
        p_worry_id: worryThread.id,
        p_content:  content,
        ...(replyToId ? { p_reply_to: replyToId } : {}),
      })
      if (error) { console.error('reply_to_worry:', error); return }
      const { data } = await supabase.rpc('get_worry_thread', { p_worry_id: worryThread.id })
      // data에 status 포함 → worryThread 전체 갱신
      setWorryThread(prev => ({ ...prev, ...data, messages: data?.messages ?? [] }))
      await loadWorries()
    }

    async function handleMarkReplied() {
      const { error } = await supabase.rpc('mark_worry_replied', { p_worry_id: worryThread.id })
      if (error) { console.error('mark_worry_replied:', error); return }
      setWorryThread(prev => ({ ...prev, status: 'replied' }))
      await loadWorries()
    }

    async function refreshThread() {
      const { data } = await supabase.rpc('get_worry_thread', { p_worry_id: worryThread.id })
      setWorryThread(prev => ({ ...prev, ...data, messages: data?.messages ?? [] }))
    }

    return (
      <WorryThread
        worry={worryThread}
        messages={worryThread.messages ?? []}
        viewerRole="teacher"
        viewerLabel="선생님 (나)"
        otherLabel={`익명 #${worryThread.anon_id}`}
        onSendReply={handleTeacherReply}
        onMarkReplied={handleMarkReplied}
        onBack={() => setWorryThread(null)}
        onRefresh={refreshThread}
      />
    )
  }

  // ── 고민 카드 렌더 ────────────────────────────────────────
  function WorryCard({ w }) {
    return (
      <button key={w.id} onClick={() => openWorry(w)}
        className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-2xl p-3 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-bold text-gray-700">익명 #{w.anon_id}</p>
            <span className="text-[9px] text-gray-400 font-normal">
              {w.target_type === 'counselor' ? '상담' : '담임'}
            </span>
            {w.status === 'replied'
              ? <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-semibold">답변완료</span>
              : w.status === 'read'
              ? <span className="text-[9px] bg-blue-100 text-blue-500 px-1.5 py-0.5 rounded-full font-semibold">읽음</span>
              : <span className="text-[9px] bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded-full font-semibold">미답변</span>
            }
          </div>
          <span className="text-[9px] text-gray-400">{formatTime(w.created_at)}</span>
        </div>
        {w.title && <p className="text-xs font-semibold text-gray-800 truncate">{w.title}</p>}
        <p className="text-[11px] text-gray-500 line-clamp-1 leading-relaxed">{w.preview}</p>
        {w.msg_count > 0 && <p className="text-[9px] text-primary-600 mt-1 font-semibold">💬 {w.msg_count}개 메시지</p>}
      </button>
    )
  }

  const totalWorries = worries.length
  const months = [...new Set(worries.map(w => getMonthKey(w.created_at)))].sort().reverse()
  const filteredWorries = worries.filter(w => getMonthKey(w.created_at) === selectedMonth)

  // ── 기본 대시보드 ─────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gray-50 pt-11 pb-32">
      <header className="bg-white px-4 py-4 shadow-sm">
        <h1 className="text-lg font-bold flex items-center gap-2">👩‍🏫 선생님 대시보드</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {profile?.school_name}{myGrade ? ` · ${myGrade}학년` : ''}{myClass ? ` ${myClass}반` : ''}
        </p>
      </header>

      <main className="px-4 py-5 space-y-4">
        {/* AI 감정 리포트 */}
        {aiReportLoading ? (
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-2/5 mb-3" />
            <div className="h-3 bg-gray-200 rounded w-full mb-2" />
            <div className="h-3 bg-gray-200 rounded w-4/5 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-3/5 mb-4" />
            <div className="flex gap-2">
              <div className="h-5 bg-gray-200 rounded-full w-14" />
              <div className="h-5 bg-gray-200 rounded-full w-14" />
              <div className="h-5 bg-gray-200 rounded-full w-14" />
            </div>
          </div>
        ) : aiReport && aiReport !== 'empty' ? (
          <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-3xl p-4 shadow-sm border border-primary-100">
            <p className="text-xs font-bold text-primary-600 mb-2">이번 주 우리 반 감정 리포트 ✨</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{aiReport.summary}</p>
            {aiReport.topTags.length > 0 && (
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {aiReport.topTags.map(tag => (
                  <span key={tag} className="text-[11px] bg-white text-primary-600 border border-primary-200 px-2.5 py-1 rounded-full font-semibold">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 mb-2">이번 주 우리 반 감정 리포트 ✨</p>
            <p className="text-xs text-gray-400 text-center py-3">이번 주 감정 데이터가 아직 없어요</p>
          </div>
        )}

        {/* 참여 통계 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500">이번 주 참여</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{activeStudents}<span className="text-base font-medium text-gray-400 ml-1">명</span></p>
          </div>
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500">수신 고민</p>
            <p className="text-3xl font-bold text-primary-600 mt-1">{totalWorries}<span className="text-base font-medium text-gray-400 ml-1">건</span></p>
          </div>
        </div>

        {/* 고민 수신함 */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              🤐 고민 수신함
              {totalWorries > 0 && (
                <span className="text-[10px] bg-coral-500 text-white px-2 py-0.5 rounded-full">{totalWorries}</span>
              )}
            </h2>
            <p className="text-[10px] text-gray-400">익명 보호</p>
          </div>

          {selectedMonth && (
            <>
              {/* 월 네비게이션 */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setSelectedMonth(prevMonthKey(selectedMonth))}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-base active:scale-95 transition-transform"
                >
                  ‹
                </button>
                <p className="text-sm font-bold text-gray-700">{getMonthLabel(selectedMonth)}</p>
                <button
                  onClick={() => setSelectedMonth(nextMonthKey(selectedMonth))}
                  disabled={selectedMonth >= getMonthKey(new Date().toISOString())}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-base active:scale-95 transition-transform disabled:opacity-30"
                >
                  ›
                </button>
              </div>

              {/* 선택 월 목록 — 미답변 먼저 */}
              {filteredWorries.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">이 달에 전달된 고민이 없어요 💚</p>
              ) : (
                <div className="space-y-2">
                  {filteredWorries.filter(w => w.status !== 'replied').map(w => <WorryCard key={w.id} w={w} />)}
                  {filteredWorries.filter(w => w.status === 'replied').map(w => <WorryCard key={w.id} w={w} />)}
                </div>
              )}
            </>
          )}
        </div>

        {/* 감정 분포 */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">감정 분포</h2>
            {/* 주 선택 탭 */}
            <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
              <button
                onClick={() => setChartWeek('this')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  chartWeek === 'this' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400'
                }`}
              >이번 주</button>
              <button
                onClick={() => setChartWeek('last')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  chartWeek === 'last' ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400'
                }`}
              >지난 주</button>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mb-2">
            {chartWeek === 'this' ? '최근 7일' : '7~14일 전'} · 익명 집계
          </p>
          <SchoolEmotionChart data={chartWeek === 'this' ? thisWeekData : lastWeekData} />
        </div>

        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl p-4 shadow-md text-white">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-2">💡 안내</h2>
          <p className="text-xs opacity-90 leading-relaxed">
            모든 데이터와 고민은 익명 처리됩니다. 같은 학생은 동일 #코드로 구분되지만 신원은 알 수 없어요.
          </p>
        </div>
      </main>
    </div>
  )
}
