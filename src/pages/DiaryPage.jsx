import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { callClaude, DIARY_SYSTEM_PROMPT, parseJsonSafe } from '../lib/claude'
import { supabase } from '../lib/supabase'

// ── 설정 ────────────────────────────────────────────────────
const MOODS = [
  { emoji: '😊', label: '기쁨',  bg: '#FFE566', ring: '#F5C800' },
  { emoji: '😐', label: '보통',  bg: '#C8DDB8', ring: '#9BBF87' },
  { emoji: '😔', label: '슬픔',  bg: '#A8D4EA', ring: '#6DB3D4' },
  { emoji: '😠', label: '분노',  bg: '#F4A27A', ring: '#E87B5A' },
  { emoji: '😰', label: '불안',  bg: '#C9B8E8', ring: '#A090C8' },
]
const MOOD_MAP = Object.fromEntries(MOODS.map(m => [m.emoji, m]))
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function toDateStr(d) { return d.toISOString().split('T')[0] }
/** 이번 주 월~일 Date 배열 반환 */
function getThisWeekDays() {
  const today = new Date()
  const dow = today.getDay() // 0=일~6=토
  const diffToMon = dow === 0 ? 6 : dow - 1
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - diffToMon + i); return d
  })
}
function getCalGrid(year, month) {
  const first = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
}
function formatDateKo(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${['일','월','화','수','목','금','토'][d.getDay()]}요일`
}

// ── 서브 컴포넌트 ────────────────────────────────────────────
function MoodCircle({ emoji, size = 'md' }) {
  const cfg = MOOD_MAP[emoji]
  if (!cfg) return <span className="text-2xl">{emoji}</span>
  const sz = { sm: 'w-9 h-9 text-xl', md: 'w-12 h-12 text-2xl', lg: 'w-16 h-16 text-3xl' }[size]
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center shadow-sm flex-shrink-0`}
      style={{ background: cfg.bg, boxShadow: `0 2px 8px ${cfg.ring}55` }}
    >
      {emoji}
    </div>
  )
}

function FeedbackCard({ summary, feedback, tags }) {
  return (
    <div className="bg-primary-50 rounded-3xl p-5 fade-up">
      <p className="text-xs text-primary-600 font-bold mb-2">🐾 오늘의 감정 요약</p>
      <p className="text-sm font-semibold text-gray-800 mb-2">{summary}</p>
      <p className="text-sm text-gray-500 leading-relaxed mb-3">{feedback}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t, i) => (
            <span key={i} className="text-xs bg-white text-primary-600 px-3 py-1 rounded-full font-semibold">#{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function DiaryPage() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [view, setView]               = useState('cal')   // cal | list | write | edit | detail
  const [diariesMap, setDiariesMap]   = useState({})
  const [selected, setSelected]       = useState(null)
  const [calDate, setCalDate]         = useState(new Date())
  const [showMenu, setShowMenu]       = useState(false)
  const [showDel, setShowDel]         = useState(false)
  const [deleting, setDeleting]       = useState(false)

  const today = toDateStr(new Date())
  const [formDate, setFormDate]   = useState(today)
  const [moodEmoji, setMoodEmoji] = useState('')
  const [content, setContent]     = useState('')
  const [aiResult, setAiResult]   = useState(null)
  const [status, setStatus]       = useState('idle') // idle|ai|saving|done|error
  const [errorMsg, setErrorMsg]   = useState('')

  useEffect(() => { loadDiaries() }, [session])

  async function loadDiaries() {
    if (!session) return
    const { data } = await supabase
      .from('diary').select('*').eq('user_id', session.user.id).order('date', { ascending: false })
    const map = {}
    ;(data || []).forEach(d => { map[d.date] = d })
    setDiariesMap(map)
  }

  function openDate(dateStr) {
    if (dateStr > today) return
    if (diariesMap[dateStr]) { setSelected(diariesMap[dateStr]); setView('detail') }
    else openWrite(dateStr)
  }

  function openWrite(dateStr = today) {
    setFormDate(dateStr); setMoodEmoji(''); setContent('')
    setAiResult(null); setStatus('idle'); setErrorMsg('')
    setView('write')
  }

  function startEdit() {
    setFormDate(selected.date); setMoodEmoji(selected.mood_emoji); setContent(selected.content)
    setAiResult(null); setStatus('idle'); setErrorMsg('')
    setShowMenu(false); setView('edit')
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('diary').delete().eq('id', selected.id)
    await loadDiaries()
    setDeleting(false); setShowDel(false); setShowMenu(false); setView('cal')
  }

  async function handleSubmit() {
    if (!moodEmoji || !content.trim() || status !== 'idle') return
    setStatus('ai'); setErrorMsg(''); setAiResult(null)

    let parsed = null
    try {
      const raw = await callClaude(DIARY_SYSTEM_PROMPT,
        [{ role: 'user', content: `기분: ${moodEmoji}\n일기: ${content.trim()}` }], 300)
      try { parsed = parseJsonSafe(raw) }
      catch { parsed = { summary: '오늘 하루도 수고했어 💚', feedback: '감정을 기록하는 것만으로도 충분해!', tags: [] } }
      setAiResult(parsed)
    } catch {
      parsed = { summary: '오늘 하루도 잘 버텼어 💚', feedback: '일기를 쓴 것만으로도 대단해!', tags: [] }
      setAiResult(parsed)
    }

    setStatus('saving')
    const { error: dbErr } = await supabase.from('diary').upsert(
      { user_id: session.user.id, date: formDate, mood_emoji: moodEmoji,
        content: content.trim(), ai_summary: parsed.summary,
        ai_feedback: parsed.feedback, emotion_tags: parsed.tags || [],
        school_code: profile?.school_code || null,
        grade: profile?.grade || null,
        class_num: profile?.class_num || null },
      { onConflict: 'user_id,date' }
    )
    if (dbErr) { setErrorMsg(`저장 오류: ${dbErr.message}`); setStatus('error'); return }
    await loadDiaries()
    setStatus('done')
  }

  // ── 캘린더 뷰 ────────────────────────────────────────────────
  if (view === 'cal') {
    const year = calDate.getFullYear(), month = calDate.getMonth()
    const grid = getCalGrid(year, month)
    const weekDays = getThisWeekDays()

    return (
      <div className="min-h-dvh pb-32 pt-16 bg-transparent">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 mb-5">
          <div className="flex items-center gap-3">
            {/* 캘린더/리스트 토글 */}
            <button onClick={() => setView('cal')} className="text-primary-600" aria-label="캘린더 보기">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>
            <button onClick={() => setView('list')} className="text-gray-300" aria-label="목록 보기">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor"/>
                <circle cx="3" cy="12" r="1.5" fill="currentColor"/><circle cx="3" cy="18" r="1.5" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <span className="text-xs text-gray-400 font-semibold">오늘의 기분을 기록해봐</span>
        </div>

        {/* 고민 털어놓기 버튼 */}
        <button
          onClick={() => navigate('/student/worry')}
          className="w-[calc(100%-2.5rem)] mx-5 mb-5 p-4 rounded-3xl bg-gradient-to-r from-coral-400 to-coral-500 text-white shadow-sm active:scale-[0.98] transition-transform flex items-center gap-3"
        >
          <span className="text-3xl">🤐</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold">고민 털어놓기</p>
            <p className="text-[10px] opacity-90 mt-0.5">익명으로 선생님께 속마음을 보내봐</p>
          </div>
          <span className="text-xl">›</span>
        </button>

        {/* 이번 주 스트립 */}
        <div className="px-5 mb-5">
          <p className="text-xs font-bold text-gray-400 mb-3">이번 주</p>
          <div className="flex justify-between">
            {weekDays.map((d, i) => {
              const ds = toDateStr(d), isToday = ds === today, entry = diariesMap[ds]
              return (
                <button key={i} onClick={() => openDate(ds)} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">{DAY_KO[d.getDay()]}</span>
                  {entry
                    ? <MoodCircle emoji={entry.mood_emoji} size="sm" />
                    : <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                        isToday ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white'
                      }`}>
                        <span className={`text-xs font-bold ${isToday ? 'text-primary-600' : 'text-gray-400'}`}>{d.getDate()}</span>
                      </div>
                  }
                </button>
              )
            })}
          </div>
        </div>

        {/* 월간 캘린더 */}
        <div className="mx-5 bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalDate(new Date(year, month - 1, 1))}
              className="w-8 h-8 flex items-center justify-center text-gray-400 text-xl rounded-full hover:bg-gray-100">‹</button>
            <p className="text-base font-bold text-gray-700">{year}년 {month + 1}월</p>
            <button onClick={() => setCalDate(new Date(year, month + 1, 1))}
              className="w-8 h-8 flex items-center justify-center text-gray-400 text-xl rounded-full hover:bg-gray-100">›</button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DAY_KO.map(d => <p key={d} className="text-center text-[10px] text-gray-300 font-semibold py-1">{d}</p>)}
          </div>

          <div className="grid grid-cols-7 gap-y-2">
            {grid.map((day, i) => {
              if (!day) return <div key={i} />
              const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isToday = ds === today, isFuture = ds > today, entry = diariesMap[ds]
              return (
                <button key={i} onClick={() => openDate(ds)} disabled={isFuture}
                  className={`flex items-center justify-center h-11 transition-all ${isFuture ? 'opacity-20 cursor-default' : ''}`}>
                  {entry
                    ? <MoodCircle emoji={entry.mood_emoji} size="sm" />
                    : <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        isToday ? 'border-2 border-primary-400 bg-primary-50' : ''
                      }`}>
                        <span className={`text-xs font-semibold ${isToday ? 'text-primary-600' : 'text-gray-500'}`}>{day}</span>
                      </div>
                  }
                </button>
              )
            })}
          </div>
        </div>

      </div>
    )
  }

  // ── 리스트(타임라인) 뷰 ──────────────────────────────────────
  if (view === 'list') {
    const entries = Object.values(diariesMap).sort((a, b) => b.date.localeCompare(a.date))
    // 월별 그룹
    const grouped = {}
    entries.forEach(e => {
      const ym = e.date.slice(0, 7) // "YYYY-MM"
      if (!grouped[ym]) grouped[ym] = []
      grouped[ym].push(e)
    })
    const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

    return (
      <div className="min-h-dvh pb-32 pt-16 bg-transparent">
        <div className="flex items-center justify-between px-5 mb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('cal')} className="text-gray-300" aria-label="캘린더 보기">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>
            <button onClick={() => setView('list')} className="text-primary-600" aria-label="목록 보기">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor"/>
                <circle cx="3" cy="12" r="1.5" fill="currentColor"/><circle cx="3" cy="18" r="1.5" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <span className="text-xs text-gray-400 font-semibold">작성한 일기 모아보기</span>
        </div>

        {/* 고민 털어놓기 버튼 */}
        <button
          onClick={() => navigate('/student/worry')}
          className="w-[calc(100%-2.5rem)] mx-5 mb-5 p-4 rounded-3xl bg-gradient-to-r from-coral-400 to-coral-500 text-white shadow-sm active:scale-[0.98] transition-transform flex items-center gap-3"
        >
          <span className="text-3xl">🤐</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold">고민 털어놓기</p>
            <p className="text-[10px] opacity-90 mt-0.5">익명으로 선생님께 속마음을 보내봐</p>
          </div>
          <span className="text-xl">›</span>
        </button>

        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 gap-3 text-gray-400">
            <span className="text-5xl">📔</span>
            <p className="text-sm">아직 일기가 없어. 오늘 첫 일기를 써봐!</p>
          </div>
        )}

        <div className="px-5 space-y-6">
          {months.map(ym => {
            const [y, m] = ym.split('-')
            return (
              <div key={ym}>
                <p className="text-base font-bold text-gray-700 mb-4">{y}년 {parseInt(m)}월</p>
                <div className="space-y-6">
                  {grouped[ym].map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => { setSelected(entry); setView('detail') }}
                      className="w-full text-left"
                    >
                      {/* 이모지 */}
                      <div className="flex gap-2 mb-2">
                        <MoodCircle emoji={entry.mood_emoji} size="md" />
                      </div>
                      {/* 날짜 */}
                      <p className="text-xs text-gray-400 mb-1.5">{formatDateKo(entry.date)}</p>
                      {/* 내용 미리보기 */}
                      {entry.content && (
                        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{entry.content}</p>
                      )}
                      {/* AI 태그 */}
                      {entry.emotion_tags?.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {entry.emotion_tags.slice(0, 3).map((t, i) => (
                            <span key={i} className="text-[10px] text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">#{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="border-b border-gray-100 mt-4" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* FAB */}
        <button
          onClick={() => openWrite(today)}
          className="fixed bottom-20 right-5 w-14 h-14 bg-primary-500 rounded-full shadow-lg flex items-center justify-center text-white text-2xl z-40"
        >
          ✏️
        </button>
      </div>
    )
  }

  // ── 상세 뷰 ──────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    return (
      <div className="min-h-dvh pt-11 pb-32 bg-transparent">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 mb-8">
          <button onClick={() => { setShowMenu(false); setView('cal') }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-500 text-lg">‹</button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-500 font-bold tracking-wider"
            >•••</button>
            {showMenu && (
              <div className="absolute right-0 top-11 bg-white rounded-2xl shadow-lg overflow-hidden z-50 w-32">
                <button onClick={startEdit}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                  ✏️ 수정하기
                </button>
                <button onClick={() => { setShowDel(true); setShowMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-50">
                  🗑️ 삭제하기
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 이모지 중앙 표시 */}
        <div className="flex justify-center mb-4">
          <MoodCircle emoji={selected.mood_emoji} size="lg" />
        </div>
        <p className="text-center text-xs text-gray-400 mb-8">{formatDateKo(selected.date)}</p>

        {/* 일기 내용 */}
        <div className="mx-5">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">{selected.content}</p>

          {selected.ai_summary && (
            <FeedbackCard
              summary={selected.ai_summary}
              feedback={selected.ai_feedback}
              tags={selected.emotion_tags || []}
            />
          )}
        </div>

        {/* 삭제 확인 바텀시트 */}
        {showDel && (
          <div
            className="fixed inset-0 flex items-end z-[200]"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setShowDel(false)}
          >
            <div
              className="bg-white w-full max-w-[420px] mx-auto rounded-t-3xl p-6"
              style={{ paddingBottom: 'calc(1.5rem + 72px)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <p className="text-base font-bold text-gray-800 text-center mb-1">일기를 삭제할까?</p>
              <p className="text-sm text-gray-400 text-center mb-7">삭제하면 복구할 수 없어 😢</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDel(false)}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl text-sm font-bold"
                >취소</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-3.5 bg-coral-500 text-white rounded-2xl text-sm font-bold disabled:opacity-50"
                >
                  {deleting ? '삭제 중...' : '삭제하기'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 작성 / 수정 뷰 ───────────────────────────────────────────
  const isEdit = view === 'edit'
  const isLoading = status === 'ai' || status === 'saving'
  const isDone = status === 'done'

  return (
    <div className="min-h-dvh pt-11 pb-32 bg-transparent">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 pt-5 mb-6">
        <button
          onClick={() => isEdit ? setView('detail') : setView('cal')}
          disabled={isLoading}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-500 text-lg disabled:opacity-40"
        >‹</button>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-700">{formDate}</p>
          {isEdit && <span className="text-[10px] text-primary-600 font-semibold">수정 중</span>}
        </div>
        <div className="w-9" />
      </div>

      <div className="px-5">
        {/* 선택된 기분 미리보기 */}
        {moodEmoji && (
          <div className="flex justify-center mb-5 fade-up">
            <MoodCircle emoji={moodEmoji} size="lg" />
          </div>
        )}

        {/* 기분 선택 */}
        <p className="text-xs font-bold text-gray-400 mb-3">오늘 기분은?</p>
        <div className="flex gap-2 mb-6">
          {MOODS.map(m => (
            <button
              key={m.emoji}
              onClick={() => !isDone && setMoodEmoji(m.emoji)}
              disabled={isDone}
              className={`flex-1 flex flex-col items-center py-3 rounded-2xl border-2 transition-all ${
                moodEmoji === m.emoji ? 'border-primary-400 bg-white shadow-sm' : 'border-transparent bg-white'
              }`}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[10px] text-gray-400 mt-1">{m.label}</span>
            </button>
          ))}
        </div>

        {/* 일기 내용 */}
        <textarea
          value={content}
          onChange={e => !isDone && setContent(e.target.value)}
          readOnly={isDone}
          placeholder="오늘 있었던 일이나 느낀 점을 자유롭게 써봐..."
          className="w-full min-h-[200px] p-4 bg-white rounded-3xl border-0 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-300/20 resize-none shadow-sm"
        />

        {status === 'ai' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-primary-600">
            <span className="animate-spin inline-block">✨</span>
            <span>AI가 감정을 분석하고 있어...</span>
          </div>
        )}
        {status === 'saving' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
            <span className="animate-pulse inline-block">💾</span>
            <span>저장하는 중...</span>
          </div>
        )}

        {aiResult && <div className="mt-4"><FeedbackCard {...aiResult} /></div>}
        {errorMsg && <p className="text-xs text-coral-500 mt-3 text-center">{errorMsg}</p>}

        {!isDone ? (
          <button
            onClick={handleSubmit}
            disabled={!moodEmoji || !content.trim() || isLoading}
            className="mt-5 w-full py-4 bg-primary-500 text-white rounded-2xl text-sm font-bold disabled:opacity-40 shadow-sm"
          >
            {status === 'ai' ? '✨ AI 분석 중...' : status === 'saving' ? '💾 저장 중...' : isEdit ? '수정 저장하기' : '일기 저장하기'}
          </button>
        ) : (
          <button
            onClick={() => setView('cal')}
            className="mt-5 w-full py-4 bg-primary-500 text-white rounded-2xl text-sm font-bold shadow-sm"
          >
            ✓ 저장 완료 · 캘린더 보기
          </button>
        )}
      </div>
    </div>
  )
}
