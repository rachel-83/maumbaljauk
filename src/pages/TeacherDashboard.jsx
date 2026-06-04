import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
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

  const schoolCode = profile?.school_code
  const myGrade    = profile?.grade
  const myClass    = profile?.class_num

  useEffect(() => {
    if (schoolCode) loadAll()
  }, [schoolCode])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadStats(), loadWorries()])
    setLoading(false)
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
    const thisWeekFrom = getISONDaysAgo(7)

    console.log('[loadWorries] 교사 프로필:', { schoolCode, myGrade, myClass })

    const { data, error } = await supabase.rpc('get_teacher_worries')

    console.log('[loadWorries] RPC 결과 raw:', { data, error })

    if (error) { console.error('[loadWorries] RPC 오류:', error); setWorries([]); return }

    const enriched = (data ?? [])
      .map(w => ({ ...w, week: w.created_at >= thisWeekFrom ? 'this' : 'last' }))

    console.log('[loadWorries] 최종 worries 목록 (%d건):', enriched.length, enriched)

    setWorries(enriched)
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

  const thisWeekWorries = worries.filter(w => w.week === 'this')
  const lastWeekWorries = worries.filter(w => w.week === 'last')
  const totalWorries = worries.length

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

          {totalWorries === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">아직 전달된 고민이 없어요 💚</p>
          ) : (
            <div className="space-y-4">
              {/* 이번 주 */}
              {thisWeekWorries.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                      이번 주 {thisWeekWorries.length}건
                    </span>
                    <span className="text-[10px] text-orange-500 font-semibold">
                      미답변 {thisWeekWorries.filter(w => !w.teacher_replied).length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {/* 미답변 먼저 */}
                    {thisWeekWorries.filter(w => !w.teacher_replied).map(w => <WorryCard key={w.id} w={w} />)}
                    {thisWeekWorries.filter(w => w.teacher_replied).map(w => <WorryCard key={w.id} w={w} />)}
                  </div>
                </div>
              )}

              {/* 지난 주 */}
              {lastWeekWorries.length > 0 && (
                <div>
                  {thisWeekWorries.length > 0 && <div className="border-t border-gray-100 my-1" />}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      지난 주 {lastWeekWorries.length}건
                    </span>
                    {lastWeekWorries.filter(w => !w.teacher_replied).length > 0 && (
                      <span className="text-[10px] text-orange-500 font-semibold">
                        미답변 {lastWeekWorries.filter(w => !w.teacher_replied).length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {lastWeekWorries.filter(w => !w.teacher_replied).map(w => <WorryCard key={w.id} w={w} />)}
                    {lastWeekWorries.filter(w => w.teacher_replied).map(w => <WorryCard key={w.id} w={w} />)}
                  </div>
                </div>
              )}
            </div>
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
