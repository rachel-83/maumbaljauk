import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { callClaude, buildChatSystemPrompt } from '../lib/claude'
import { supabase } from '../lib/supabase'
import TypingIndicator from '../components/TypingIndicator'
import ExpertBanner from '../components/ExpertBanner'

const PET_IMG = {
  dog:    '/assets/characters/dog.png',
  cat:    '/assets/characters/cat.png',
  rabbit: '/assets/characters/rabbit.png',
  bear:   '/assets/characters/bear.png',
}

// 감정 이모지 → 이미지 suffix 매핑 (불안은 sad 이미지 공용)
const MOOD_SUFFIX = {
  '😊': 'happy',
  '😐': 'normal',
  '😔': 'sad',
  '😠': 'angry',
  '😰': 'sad',
}

function getPetImg(petType, moodEmoji) {
  const suffix = MOOD_SUFFIX[moodEmoji]
  if (!suffix) return PET_IMG[petType] || PET_IMG.dog
  return `/assets/characters/${petType || 'dog'}_${suffix}.png`
}

function parseTags(text) {
  const match = text.match(/\[TAGS:\s*(\{.*?\})\]/s)
  if (!match) return { clean: text, tags: [] }
  try {
    const { tags } = JSON.parse(match[1])
    return { clean: text.replace(match[0], '').trim(), tags: tags || [] }
  } catch {
    return { clean: text.replace(match[0], '').trim(), tags: [] }
  }
}

function ChatBubble({ role, content, petImg, time }) {
  const isUser = role === 'user'
  return (
    <div className={`flex items-end gap-2 mb-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <img src={petImg} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 shadow-sm" />}
      <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
        isUser
          ? 'bg-primary-500 text-white rounded-br-sm shadow-md shadow-primary-200'
          : 'glass text-gray-800 rounded-bl-sm'
      }`}>
        <p className="whitespace-pre-wrap">{content}</p>
        <p className={`text-[10px] mt-1 ${isUser ? 'text-green-200' : 'text-gray-400'}`}>{time}</p>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { session, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState('')
  const [neisContext, setNeisContext] = useState('')
  const [todayMood, setTodayMood] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const petImg = getPetImg(profile?.pet_type, todayMood)
  const petName = profile?.pet_name || '말동무'

  // 오늘 일기 기분 로드
  useEffect(() => {
    if (!session) return
    const today = new Date()
    const ymd = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    supabase.from('diary').select('mood_emoji').eq('user_id', session.user.id).eq('date', ymd).maybeSingle()
      .then(({ data }) => { if (data?.mood_emoji) setTodayMood(data.mood_emoji) })
  }, [session])

  // 이전 대화 로드
  useEffect(() => {
    if (!session) return
    supabase
      .from('chat_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(data.map(r => ({
            role: r.role,
            content: r.content,
            time: new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          })))
        } else {
          // 첫 인사
          setMessages([{
            role: 'pet',
            content: `안녕! 나는 ${petName}이야 🐾\n무슨 얘기든 편하게 해줘, 다 들을게!`,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          }])
        }
      })

    // NEIS 데이터 펫치 (배경)
    async function fetchNeisContext() {
      if (!profile?.school_code || !profile?.sido_code) return
      try {
        const apiKey = import.meta.env.VITE_NEIS_API_KEY || ''
        const now = new Date()
        // 로컬 날짜 YYYYMMDD (UTC 오프셋 문제 방지)
        const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
        const sido = profile.sido_code
        const school = profile.school_code
        const keyParam = apiKey ? `&KEY=${apiKey}` : ''

        // ── 급식 조회 (중식 우선) ───────────────────────────
        let lunchMenu = ''
        let mealDate = ymd
        try {
          // 오늘 급식 시도
          let res = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=5&ATPT_OFCDC_SC_CODE=${sido}&SD_SCHUL_CODE=${school}&MLSV_YMD=${ymd}${keyParam}`)
          let data = await res.json()
          let rows = data?.mealServiceDietInfo?.[1]?.row

          // 오늘 급식 없으면 다음 평일(월요일) 시도
          if (!rows) {
            const nextDay = new Date(now)
            const dow = nextDay.getDay()
            if (dow === 0) nextDay.setDate(nextDay.getDate() + 1) // 일→월
            else if (dow === 6) nextDay.setDate(nextDay.getDate() + 2) // 토→월
            mealDate = `${nextDay.getFullYear()}${String(nextDay.getMonth()+1).padStart(2,'0')}${String(nextDay.getDate()).padStart(2,'0')}`
            if (mealDate !== ymd) {
              res = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=5&ATPT_OFCDC_SC_CODE=${sido}&SD_SCHUL_CODE=${school}&MLSV_YMD=${mealDate}${keyParam}`)
              data = await res.json()
              rows = data?.mealServiceDietInfo?.[1]?.row
            }
          }

          if (rows) {
            // 중식(2) 우선 → 없으면 첫 번째
            const lunch = rows.find(r => r.MMEAL_SC_CODE === '2') || rows[0]
            const menu = lunch.DDISH_NM
              .replace(/<br\/>/g, ', ')
              .replace(/\s*\([0-9.,\s]+\)/g, '')
              .replace(/\(기\)|\(기,수\)|\(수\)/g, '')
              .trim()
            const dateLabel = mealDate === ymd ? '오늘' : '내일(월)'
            lunchMenu = `${dateLabel} ${lunch.MMEAL_SC_NM}: ${menu}`
          }
        } catch (e) { console.warn('급식 조회 실패:', e) }

        // ── 학사일정 조회 ────────────────────────────────────
        let scheduleEvent = ''
        try {
          const res = await fetch(`https://open.neis.go.kr/hub/SchoolSchedule?Type=json&pIndex=1&pSize=5&ATPT_OFCDC_SC_CODE=${sido}&SD_SCHUL_CODE=${school}&AA_YMD=${ymd}${keyParam}`)
          const data = await res.json()
          const rows = data?.SchoolSchedule?.[1]?.row
          if (rows) {
            const events = rows.map(r => r.EVENT_NM).filter(e => e && e !== '토요휴업일' && e !== '공휴일')
            if (events.length > 0) scheduleEvent = events.join(', ')
          }
        } catch (e) { console.warn('학사일정 조회 실패:', e) }

        // ── 시간표 조회 ──────────────────────────────────────
        let timetable = ''
        try {
          if (profile.grade && profile.class_num && profile.school_name) {
            let endpoint = ''
            if (profile.school_name.includes('초등')) endpoint = 'elsTimetable'
            else if (profile.school_name.includes('중학')) endpoint = 'misTimetable'
            else if (profile.school_name.includes('고등')) endpoint = 'hisTimetable'
            else if (profile.school_name.includes('특수')) endpoint = 'spsTimetable'
            
            if (endpoint) {
              const res = await fetch(`https://open.neis.go.kr/hub/${endpoint}?Type=json&pIndex=1&pSize=15&ATPT_OFCDC_SC_CODE=${sido}&SD_SCHUL_CODE=${school}&ALL_TI_YMD=${ymd}&GRADE=${profile.grade}&CLASS_NM=${profile.class_num}${keyParam}`)
              const data = await res.json()
              const rows = data?.[endpoint]?.[1]?.row
              if (rows) {
                const sortedRows = [...rows].sort((a, b) => parseInt(a.PERIO) - parseInt(b.PERIO))
                const subjects = sortedRows.map(r => `${r.PERIO}교시: ${r.ITRT_CNTNT.replace(/\*/g, '').trim()}`)
                if (subjects.length > 0) timetable = subjects.join(', ')
              } else {
                timetable = '(오늘 등록된 시간표 데이터가 없습니다)'
              }
            }
          }
        } catch (e) { console.warn('시간표 조회 실패:', e) }

        // 컨텍스트 조합
        const parts = []
        if (lunchMenu) parts.push(`- 급식: ${lunchMenu}`)
        if (scheduleEvent) parts.push(`- 학사일정: ${scheduleEvent}`)
        if (timetable) parts.push(`- 시간표: ${timetable}`)
        if (parts.length > 0) setNeisContext(parts.join('\n'))
      } catch (e) {
        console.error('NEIS 데이터 조회 실패:', e)
      }
    }
    fetchNeisContext()

  }, [session, petName, petImg, profile])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  async function handleSend() {
    const text = input.trim()
    if (!text || typing) return
    setInput('')
    setError('')

    const now = new Date()
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

    const userMsg = { role: 'user', content: text, time: timeStr }
    setMessages(prev => [...prev, userMsg])
    setTyping(true)

    // Supabase 저장 (await으로 확실히 저장)
    await supabase.from('chat_logs').insert({
      user_id: session.user.id,
      role: 'user',
      content: text,
      school_code: profile?.school_code || null,
    })

    // Claude API 호출
    const history = [...messages, userMsg]
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'pet' ? 'assistant' : 'user', content: m.content }))

    try {
      const systemPrompt = buildChatSystemPrompt(petName, profile?.pet_type || 'dog', neisContext, profile?.school_name || '')
      const raw = await callClaude(systemPrompt, history)
      const { clean, tags } = parseTags(raw)
      const petMsg = { role: 'pet', content: clean, time: timeStr }
      setMessages(prev => [...prev, petMsg])

      await supabase.from('chat_logs').insert({
        user_id: session.user.id,
        role: 'pet',
        content: clean,
        emotion_tags: tags,
        school_code: profile?.school_code || null,
      })
    } catch (e) {
      console.error('Claude API error:', e)
      let msg
      if (e.name === 'AbortError') {
        msg = '응답 시간이 너무 걸려서 실패했어 😢 다시 한번 보내줘!'
      } else if (e.message?.includes('바빠') || e.message?.toLowerCase().includes('overload')) {
        msg = '지금 서버가 많이 바쁜가봐 😓 잠깐 기다렸다가 다시 얘기해줘!'
      } else {
        msg = '앗, 연결에 문제가 생겼어 😢 다시 한번 보내줄래?'
      }
      setError(msg)
    } finally {
      setTyping(false)
    }
  }

  return (
    <div className="flex flex-col h-dvh pt-11 pb-16">
      {/* 헤더 (펫 아바타) */}
      <header className="px-4 py-3 glass-strong shadow-sm flex items-center gap-3">
        <img src={petImg} alt={petName} className="w-10 h-10 rounded-full object-cover shadow-sm" />
        <div className="flex-1">
          <p className="font-bold text-gray-800">{petName}</p>
          <p className="text-xs text-primary-500">언제든 얘기해줘 🐾</p>
        </div>
        <button
          onClick={async () => {
            if (!confirm('대화 기록을 모두 지울까?\n(삭제하면 복구할 수 없어)')) return
            await supabase.from('chat_logs').delete().eq('user_id', session.user.id)
            setMessages([{
              role: 'pet',
              content: `안녕! 나는 ${petName}이야 🐾\n무슨 얘기든 편하게 해줘, 다 들을게!`,
              time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            }])
          }}
          className="text-[10px] text-gray-400 bg-white/60 px-2.5 py-1.5 rounded-full font-semibold active:scale-95 transition-transform"
        >
          기록 지우기
        </button>
      </header>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
        <ExpertBanner />
        <div className="mt-4">
          {messages.map((m, i) => (
            <ChatBubble key={i} {...m} petImg={petImg} />
          ))}
          {typing && <TypingIndicator petImg={petImg} />}
          {error && <p className="text-xs text-center text-coral-500 py-2">{error}</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 입력창 */}
      <div className="px-4 pb-4 pt-2 glass-strong border-t border-white/40">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={`${petName}에게 오늘 있었던 일을 얘기해줘...`}
            rows={1}
            className="flex-1 px-4 py-3 bg-white/60 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300/30"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || typing}
            className="w-11 h-11 bg-primary-500 text-white rounded-2xl flex items-center justify-center text-lg disabled:opacity-40 flex-shrink-0"
            aria-label="전송"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
