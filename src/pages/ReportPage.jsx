import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { callClaude, REPORT_SYSTEM_PROMPT, WEEKLY_ANALYSIS_PROMPT } from '../lib/claude'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const DAY_KO     = ['일', '월', '화', '수', '목', '금', '토']

// ── 단어 감정 분류 ───────────────────────────────────────────
const POSITIVE_ROOTS = [
  // 기쁨·행복
  '기쁘','기뻐','기뻤','기분좋','행복','행복해','행복했','좋아','좋았','좋은','좋겠','좋네',
  // 즐거움·신남
  '즐거','즐겁','즐겼','신나','신났','신기','설레','설렜','설레는','설레었',
  // 감사·고마움
  '감사','감사해','감동','고마','고마워','고마웠','감격',
  // 사랑·애정
  '사랑','사랑해','사랑했','소중','소중해','소중한',
  // 재미·웃음
  '재미','재밌','재미있','웃음','웃었','웃어','웃긴','유쾌','우습','재밌었',
  // 성취·칭찬
  '뿌듯','성공','해냈','잘됐','해결','칭찬','통과','합격','이겼','완성','달성',
  // 위로·편안
  '다행','편하','편했','홀가분','후련','포근','든든','안심','안도','다행이',
  // 희망·긍정
  '희망','용기','의욕','활기','보람','기대','상쾌','가능','긍정',
  // 관계·화해
  '화해','친해','친하','함께','같이 있','좋은 친','멋있','귀여','예쁘','예뻐',
  // 기타 긍정
  '따뜻','뭉클','벅차','짜릿','흐뭇','나아졌','좋아졌','풀렸','해결됐',
]

const NEGATIVE_ROOTS = [
  // 슬픔
  '슬프','슬펐','슬퍼','슬픔','눈물','울었','울어','울었어','울컥','서러','서러웠',
  // 힘듦·지침
  '힘들','힘드','힘겨','지치','지쳤','지쳐','피곤','무기력','기운없','녹초',
  // 화·분노
  '화나','화났','화가','짜증','짜증나','짜증났','열받','열이나','분하','억울',
  // 불안·걱정
  '불안','걱정','걱정돼','걱정했','두렵','두려','무섭','무서','겁나','겁났','무서웠',
  // 우울·외로움
  '우울','외로','외롭','외로웠','쓸쓸','고독','적적','허전','허탈',
  // 싫음·미움
  '싫어','싫었','싫은','미워','미웠','밉','싫증','혐오',
  // 아픔·상처
  '아프','아팠','아파','아픈','상처','상처받','속상','속상해','속상했',
  // 실패·후회
  '실망','실패','후회','망했','망해','틀렸','실수','못했','안됐','포기',
  // 관계 갈등
  '싸웠','싸우','다퉜','다투','혼났','혼나','무시','따돌','왕따','배신',
  // 기타 부정
  '스트레스','답답','막막','절망','비참','고통','괴로','괴롭','부담','그리워','그리웠',
]

function classifyWord(word) {
  for (const root of POSITIVE_ROOTS) { if (word.includes(root)) return 'positive' }
  for (const root of NEGATIVE_ROOTS) { if (word.includes(root)) return 'negative' }
  return 'neutral'
}

const STOP_WORDS = new Set([
  '나는','나를','나의','내가','우리','저희','이건','이게','이거','그건','그게','그거',
  '뭔가','뭐가','무언가','어떤','이런','저런','그런','이렇게','저렇게','그렇게','어떻게',
  '정말','진짜','너무','많이','조금','좀','그냥','이제','지금','오늘','어제','내일',
  '이번','지난','다음','다시','계속','항상','늘','자꾸','갑자기','사실','아직','벌써',
  '드디어','결국','혹시','만약','약간','매우','엄청','굉장히','요즘','최근','여전히',
  '근데','그런데','하지만','그래서','그리고','왜냐면','그래도','그러면','그러나',
  '있어','없어','했어','같아','같은데','싶어','됐어','않아','모르겠어',
  '이야','예요','이에요','입니다','합니다','해요','있는데','없는데',
  '것같아','거야','건데','때문에','위해서','통해서',
  '때문','위해','통해','이후','이전','처음','나중','정도',
])

function extractWordsByType(texts, type, topN = 5) {
  const count = {}
  texts.forEach(text => {
    if (!text) return
    const cleaned = text.replace(/[^\uAC00-\uD7A3\s]/g, ' ')
    cleaned.split(/\s+/).forEach(word => {
      if (word.length < 2) return
      if (STOP_WORDS.has(word)) return
      if (classifyWord(word) === type) {
        count[word] = (count[word] ?? 0) + 1
      }
    })
  })
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, cnt]) => ({ word, cnt }))
}
const MOOD_COLOR = { '😊': '#6BB5A6', '😐': '#B0B0B0', '😔': '#A0B8E8', '😠': '#E87B5A', '😰': '#C9B8E8' }
const MOOD_SCORE = { '😊': 5, '😐': 3, '😔': 2, '😠': 2, '😰': 2 }
const MOOD_LABEL = { '😊': '기쁨', '😐': '보통', '😔': '슬픔', '😠': '분노', '😰': '불안' }
const NEGATIVE_MOODS = new Set(['😔', '😠', '😰'])

/** 주차 오프셋만큼 떨어진 주(월~일)의 날짜 배열 반환
 *  weekOffset: 0=이번주, -1=지난주, 1=다음주
 */
function getWeekDateStrs(weekOffset = 0) {
  const today = new Date()
  const dow = today.getDay()
  const diffToMon = dow === 0 ? 6 : dow - 1
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - diffToMon + i + weekOffset * 7)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })
}

function formatWeekRange(weekDates) {
  const start = new Date(weekDates[0])
  const end = new Date(weekDates[6])
  return `${start.getMonth()+1}/${start.getDate()} ~ ${end.getMonth()+1}/${end.getDate()}`
}

const RANK_LABEL = ['①', '②', '③', '④', '⑤']

function WordRankCard({ title, words, colors, sub, empty }) {
  return (
    <div className="glass rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-700">{title}</p>
        <p className="text-[10px] text-gray-400">{sub ?? '일기 + 대화 기준'}</p>
      </div>
      {words.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-5">{empty}</p>
      ) : (
        <div className="space-y-3">
          {words.map((w, i) => {
            const maxCnt = words[0].cnt
            return (
              <div key={w.word} className="flex items-center gap-3">
                <span className="text-base w-5 flex-shrink-0 text-center font-bold" style={{ color: colors[i] }}>
                  {RANK_LABEL[i]}
                </span>
                <span className="text-sm font-bold text-gray-700 w-20 flex-shrink-0 truncate">{w.word}</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.round(w.cnt / maxCnt * 100)}%`, background: colors[i] }}
                  />
                </div>
                <span className="text-[11px] text-gray-400 w-10 text-right flex-shrink-0">{w.cnt}번</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// 마크다운 특수문자 제거
function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s*/gm, '')          // ## 헤더
    .replace(/\*\*(.*?)\*\*/g, '$1')       // **볼드**
    .replace(/\*(.*?)\*/g, '$1')           // *이탤릭*
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')  // `코드`
    .replace(/^>\s*/gm, '')               // > 인용
    .replace(/^-{3,}$/gm, '')             // --- 구분선
    .replace(/^[*-]\s+/gm, '• ')          // - 목록
    .replace(/\n{3,}/g, '\n\n')           // 과도한 줄바꿈
    .trim()
}

export default function ReportPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [weekOffset,  setWeekOffset]  = useState(0)  // 0=이번주, -1=지난주
  const [weekData,    setWeekData]    = useState([])
  const [emotionDist, setEmotionDist] = useState([])
  const [stats,       setStats]       = useState({ chats: 0, weekDiaries: 0, totalDiaries: 0, topEmotion: '-' })
  const [aiMessage,   setAiMessage]   = useState('')
  const [topPosWords,     setTopPosWords]     = useState([])
  const [topNegWords,     setTopNegWords]     = useState([])
  const [weeklyAnalysis,  setWeeklyAnalysis]  = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [aiLoading,       setAiLoading]       = useState(false)

  // 반려동물 체험 추천
  const [petRecommend, setPetRecommend] = useState(null) // { emotion, show }
  const [dismissed, setDismissed]       = useState(false)

  useEffect(() => {
    // 오늘 이미 닫았는지 확인
    const key = 'pet_recommend_dismissed_' + new Date().toISOString().split('T')[0]
    if (localStorage.getItem(key)) setDismissed(true)
  }, [])

  useEffect(() => { if (session) loadData() }, [session, weekOffset, location.key])

  async function loadData() {
    setLoading(true)
    const uid = session.user.id
    const weekDates = getWeekDateStrs(weekOffset)
    const weekStart = weekDates[0]
    const weekEnd   = weekDates[6]

    // 1. 이번 주 일기
    const { data: weekDiaryData } = await supabase
      .from('diary').select('date, mood_emoji, emotion_tags, content')
      .eq('user_id', uid).gte('date', weekStart).lte('date', weekEnd)

    // 2. 전체 일기 수
    const { count: totalCount } = await supabase
      .from('diary').select('id', { count: 'exact', head: true }).eq('user_id', uid)

    // 3. 이번 주 채팅 수 + 외로움 키워드 체크
    const { count: chatCount } = await supabase
      .from('chat_logs').select('id', { count: 'exact', head: true })
      .eq('user_id', uid).gte('created_at', weekStart + 'T00:00:00.000Z')

    const { data: chatLogs } = await supabase
      .from('chat_logs').select('content, emotion_tags')
      .eq('user_id', uid).eq('role', 'user')
      .gte('created_at', weekStart + 'T00:00:00.000Z')

    // 바 차트
    const diaryByDate = {}
    weekDiaryData?.forEach(d => { diaryByDate[d.date] = d })

    const bars = weekDates.map(dateStr => {
      const dow   = new Date(dateStr).getDay()
      const diary = diaryByDate[dateStr]
      const emoji = diary?.mood_emoji ?? null
      return {
        day: DAY_KO[dow], date: dateStr,
        score: emoji ? (MOOD_SCORE[emoji] ?? 3) : 0,
        emoji, color: emoji ? (MOOD_COLOR[emoji] ?? '#B0B0B0') : '#E8E8E8',
      }
    })
    setWeekData(bars)

    // 감정 분포 (mood_emoji 기준)
    const moodCount = {}
    weekDiaryData?.forEach(d => {
      const label = MOOD_LABEL[d.mood_emoji] ?? d.mood_emoji
      moodCount[label] = (moodCount[label] ?? 0) + 1
    })
    const sorted = Object.entries(moodCount).sort((a, b) => b[1] - a[1])
    const total  = sorted.reduce((s, [, c]) => s + c, 0)
    const dist   = sorted.map(([name, count], i) => ({
      name, count,
      pct: total ? Math.round(count / total * 100) : 0,
      color: Object.values(MOOD_COLOR)[i] ?? '#B0B0B0',
    }))
    setEmotionDist(dist)

    setStats({
      chats: chatCount ?? 0,
      weekDiaries: weekDiaryData?.length ?? 0,
      totalDiaries: totalCount ?? 0,
      topEmotion: sorted[0]?.[0] ?? '-',
    })

    // ── 반려동물 체험 추천 트리거 체크 ──────────────────────
    checkPetRecommendation(weekDiaryData ?? [], chatLogs ?? [], weekDates)

    // ── TOP 5 긍정/부정 단어 분석 (최근 4주 누적) ──────────────
    const fourWeekStart = new Date(weekDates[0])
    fourWeekStart.setDate(fourWeekStart.getDate() - 21)
    const fourWeekStartStr = `${fourWeekStart.getFullYear()}-${String(fourWeekStart.getMonth()+1).padStart(2,'0')}-${String(fourWeekStart.getDate()).padStart(2,'0')}`

    const [{ data: recentDiaries }, { data: recentChats }] = await Promise.all([
      supabase.from('diary').select('content')
        .eq('user_id', uid)
        .gte('date', fourWeekStartStr)
        .lte('date', weekDates[6]),
      supabase.from('chat_logs').select('content')
        .eq('user_id', uid).eq('role', 'user')
        .gte('created_at', fourWeekStartStr + 'T00:00:00.000Z')
        .lte('created_at', weekDates[6] + 'T23:59:59.999Z'),
    ])
    const recentTexts = [
      ...(recentDiaries ?? []).map(d => d.content),
      ...(recentChats ?? []).map(c => c.content),
    ]
    const posWords = extractWordsByType(recentTexts, 'positive', 5)
    const negWords = extractWordsByType(recentTexts, 'negative', 5)
    setTopPosWords(posWords)
    setTopNegWords(negWords)

    setLoading(false)
    generateAiMessage(bars, sorted)

    // 종합 분석은 비동기 병렬 실행
    generateWeeklyAnalysis({
      weekLabel: weekOffset === 0 ? '이번 주' : weekOffset === -1 ? '지난 주' : `${Math.abs(weekOffset)}주 전`,
      bars,
      sorted,
      diaries: weekDiaryData ?? [],
      chatLogs: chatLogs ?? [],
      posWords,
      negWords,
    })
  }

  function checkPetRecommendation(diaries, chats, weekDates) {
    // 조건 1: 슬픔·분노·불안 3일 연속
    const diaryByDate = {}
    diaries.forEach(d => { diaryByDate[d.date] = d })
    let consecutive = 0
    let maxConsecutive = 0
    for (const dateStr of weekDates) {
      const diary = diaryByDate[dateStr]
      if (diary && NEGATIVE_MOODS.has(diary.mood_emoji)) {
        consecutive++
        maxConsecutive = Math.max(maxConsecutive, consecutive)
      } else {
        consecutive = 0
      }
    }
    const trigger1 = maxConsecutive >= 3

    // 조건 2: 주간 부정 감정 비율 60% 이상
    const totalDiaries = diaries.length
    const negativeDiaries = diaries.filter(d => NEGATIVE_MOODS.has(d.mood_emoji)).length
    const negativeRatio = totalDiaries > 0 ? negativeDiaries / totalDiaries : 0
    const trigger2 = totalDiaries >= 2 && negativeRatio >= 0.6

    // 조건 3: 챗봇 외로움 키워드 3회 이상
    const lonelyKeywords = ['외로', '혼자', '친구가 없', '아무도', '쓸쓸', '고독']
    let lonelyCount = 0
    chats.forEach(c => {
      if (lonelyKeywords.some(k => c.content?.includes(k))) lonelyCount++
      if (c.emotion_tags?.some(t => t.includes('외로'))) lonelyCount++
    })
    const trigger3 = lonelyCount >= 3

    if (trigger1 || trigger2 || trigger3) {
      // 주요 부정 감정 결정
      const negMoodCount = {}
      diaries.forEach(d => {
        if (NEGATIVE_MOODS.has(d.mood_emoji)) {
          const label = MOOD_LABEL[d.mood_emoji]
          negMoodCount[label] = (negMoodCount[label] ?? 0) + 1
        }
      })
      const topNeg = Object.entries(negMoodCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '힘들'
      setPetRecommend({ emotion: topNeg })
    }
  }

  async function generateWeeklyAnalysis({ weekLabel, bars, sorted, diaries, chatLogs, posWords, negWords }) {
    if (!bars.some(b => b.score > 0)) return
    setAnalysisLoading(true)
    try {
      // 일기 내용 요약 (최대 300자)
      const diarySnippet = diaries
        .map(d => `[${d.date} ${d.mood_emoji}] ${(d.content || '').slice(0, 60)}`)
        .join('\n')
        .slice(0, 300)

      // 챗봇 대화 요약 (최대 200자)
      const chatSnippet = chatLogs
        .map(c => c.content?.slice(0, 50))
        .filter(Boolean)
        .join(' / ')
        .slice(0, 200)

      const input = `
[기간] ${weekLabel}
[기분 변화] ${bars.map(b => `${b.day}요일: ${b.emoji ?? '미기록'}`).join(', ')}
[감정 분포] ${sorted.map(([e, c]) => `${e} ${c}번`).join(', ') || '없음'}
[자주 쓴 긍정 단어] ${posWords.map(w => w.word).join(', ') || '없음'}
[자주 쓴 부정 단어] ${negWords.map(w => w.word).join(', ') || '없음'}
[일기 내용 일부] ${diarySnippet || '없음'}
[챗봇 대화 내용 일부] ${chatSnippet || '없음'}
`.trim()

      const result = await callClaude(WEEKLY_ANALYSIS_PROMPT, [{ role: 'user', content: input }], 400)
      setWeeklyAnalysis(stripMarkdown(result))
    } catch {
      setWeeklyAnalysis('이번 주 데이터를 분석했어. 꾸준히 기록해줘서 고마워 💚')
    }
    setAnalysisLoading(false)
  }

  async function generateAiMessage(bars, topTags) {
    setAiLoading(true)
    try {
      const hasData = bars.some(b => b.score > 0)
      if (!hasData) { setAiMessage('아직 이번 주 기록이 없어. 오늘 일기를 써봐! 💚'); setAiLoading(false); return }
      const summary = `이번 주 감정(요일:점수): ${bars.map(b => `${b.day}:${b.score}`).join(', ')}. 주요 감정: ${topTags.slice(0,3).map(([t])=>t).join(', ') || '없음'}`
      const msg = await callClaude(REPORT_SYSTEM_PROMPT, [{ role: 'user', content: summary }], 150)
      setAiMessage(stripMarkdown(msg))
    } catch {
      setAiMessage('이번 주도 감정을 기록해줘서 고마워 💚')
    }
    setAiLoading(false)
  }

  function dismissRecommend() {
    setDismissed(true)
    const key = 'pet_recommend_dismissed_' + new Date().toISOString().split('T')[0]
    localStorage.setItem(key, 'true')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-gray-400 text-sm animate-pulse">데이터 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="pb-36 px-4 pt-16 min-h-dvh">
      <h1 className="text-xl font-bold text-gray-800 mb-3">📊 주간 감정 레포트</h1>

      {/* 주차 네비게이터 */}
      <div className="flex items-center justify-between mb-5 glass rounded-2xl px-3 py-2 shadow-sm" style={{ position: 'relative' }}>
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-primary-600 hover:bg-primary-50 active:scale-95 transition-all"
          aria-label="이전 주"
        >‹</button>
        <div className="text-center">
          <p className="text-xs font-bold text-gray-700">
            {weekOffset === 0 ? '이번 주' : weekOffset === -1 ? '지난 주' : `${Math.abs(weekOffset)}주 전`}
          </p>
          <p className="text-[10px] text-gray-400">{formatWeekRange(getWeekDateStrs(weekOffset))}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
            disabled={weekOffset >= 0}
            className="w-8 h-8 flex items-center justify-center rounded-full text-primary-600 hover:bg-primary-50 active:scale-95 transition-all disabled:opacity-30"
            aria-label="다음 주"
          >›</button>
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-30"
            aria-label="새로고침"
            title="데이터 새로고침"
          >↺</button>
        </div>
      </div>

      {/* AI 한마디 */}
      <div className="glass rounded-3xl p-4 mb-5 flex items-start gap-3 shadow-sm">
        <span className="text-2xl flex-shrink-0">🐾</span>
        <p className="text-sm text-gray-700 leading-relaxed">
          {aiLoading ? <span className="text-gray-400 animate-pulse">분석 중...</span> : aiMessage}
        </p>
      </div>

      {/* 반려동물 체험 추천 카드 */}
      {petRecommend && !dismissed && (
        <div className="relative mb-5 rounded-3xl overflow-hidden shadow-md fade-up"
          style={{ background: 'linear-gradient(135deg, #FFF5EC 0%, #E8F0FE 50%, #F5F0FF 100%)' }}>
          <button onClick={dismissRecommend}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-gray-400 text-xs font-bold z-10">
            ✕
          </button>
          <div className="p-5">
            <p className="text-base font-bold text-gray-800 leading-snug mb-1">
              이번 주 많이 {petRecommend.emotion}했구나 🐾
            </p>
            <p className="text-sm text-gray-600 mb-4">
              동물 친구들을 직접 만나보는 건 어때?
            </p>
            <button
              onClick={() => navigate('/student/expert')}
              className="w-full py-3 bg-primary-500 text-white rounded-2xl text-sm font-bold shadow-md shadow-primary-200 active:scale-[0.98] transition-transform"
            >
              🐕 체험 프로그램 보러가기 →
            </button>
          </div>
          <div className="text-center pb-3">
            <span className="text-5xl float">🐶</span>
          </div>
        </div>
      )}

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="glass rounded-2xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-primary-600">{stats.weekDiaries}</p>
          <p className="text-[10px] text-gray-400 mt-1">{weekOffset === 0 ? '이번주' : '해당주'} 일기</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-coral-500">{stats.totalDiaries}</p>
          <p className="text-[10px] text-gray-400 mt-1">전체 일기</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center shadow-sm">
          <p className="text-sm font-bold text-gray-700 truncate px-1">{stats.topEmotion}</p>
          <p className="text-[10px] text-gray-400 mt-1">{weekOffset === 0 ? '이번주' : '해당주'} 감정</p>
        </div>
      </div>

      {/* 이번 주 기분 변화 */}
      <div className="glass rounded-3xl p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-700">이번 주 기분 변화</p>
          <p className="text-[10px] text-gray-400">이번 주 일기 {stats.weekDiaries}개</p>
        </div>
        {stats.weekDiaries === 0 && !weekData.some(b => b.score > 0) ? (
          <p className="text-xs text-gray-400 text-center py-8">이번 주 일기를 써야 차트가 보여!</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weekData} barSize={28} barCategoryGap="25%">
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 6]} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ payload }) => {
                    if (!payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-white rounded-xl shadow-md px-3 py-2 text-xs border border-gray-100">
                        <p className="font-semibold text-gray-700">{d.date}</p>
                        <p>{d.emoji ? `${d.emoji} 기록됨` : '기록 없음'}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="score" radius={[8, 8, 4, 4]}>
                  {weekData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-2 justify-center flex-wrap">
              {Object.entries(MOOD_COLOR).map(([e, c]) => (
                <span key={e} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
                  {e}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 감정 분포 */}
      <div className="glass rounded-3xl p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-700">감정 분포</p>
          <p className="text-[10px] text-gray-400">이번 주 일기 기준</p>
        </div>
        {emotionDist.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">📝 일기를 쓰면 감정 분포가 보여!</p>
        ) : (
          <div className="space-y-3">
            {emotionDist.map(e => (
              <div key={e.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">#{e.name}</span>
                  <span className="text-gray-400">{e.pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${e.pct}%`, background: e.color, transition: 'width 0.7s ease' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 자주 쓴 긍정 단어 TOP 5 */}
      <div className="mb-5">
        <WordRankCard
          title="🌟 자주 쓴 긍정 단어 TOP 5"
          words={topPosWords}
          colors={['#6BB5A6', '#52C4AF', '#3DBDA6', '#2EB59D', '#1FAD94']}
          sub={weekOffset === 0 ? '이번 주 일기 + 대화 기준' : '해당 주 일기 + 대화 기준'}
          empty="긍정적인 말을 더 써봐! 📝"
        />
      </div>

      {/* 자주 쓴 부정 단어 TOP 5 */}
      <div className="mb-5">
        <WordRankCard
          title="🌧 자주 쓴 부정 단어 TOP 5"
          words={topNegWords}
          colors={['#A0B8E8', '#8FAADE', '#7E9CD4', '#6D8ECA', '#5C80C0']}
          sub={weekOffset === 0 ? '이번 주 일기 + 대화 기준' : '해당 주 일기 + 대화 기준'}
          empty="부정적인 단어가 없어, 잘 지내고 있구나! 💚"
        />
      </div>

      {/* 종합 AI 분석 */}
      <div className="mb-5 rounded-3xl overflow-hidden shadow-md"
        style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f5f0 50%, #fdf0ff 100%)' }}>
        <div className="px-5 pt-5 pb-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🧠</span>
            <p className="text-sm font-bold text-gray-800">AI 종합 감정 분석</p>
            <span className="text-[10px] text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full font-semibold ml-auto">
              일기 · 대화 · 감정 통합
            </span>
          </div>
        </div>

        {analysisLoading ? (
          <div className="px-5 pb-5 flex items-center gap-3">
            <span className="text-xl animate-spin inline-block">✨</span>
            <p className="text-sm text-gray-400 animate-pulse">데이터를 종합 분석하고 있어...</p>
          </div>
        ) : weeklyAnalysis ? (
          <div className="px-5 pb-5">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{weeklyAnalysis}</p>
          </div>
        ) : (
          <div className="px-5 pb-5">
            <p className="text-xs text-gray-400 text-center py-3">일기를 쓰면 종합 분석이 생성돼!</p>
          </div>
        )}

        <div className="px-5 py-3 bg-white/40 border-t border-white/60">
          <p className="text-[10px] text-gray-400 text-center">
            AI 분석은 참고용이에요. 전문 상담이 필요하면 학교 상담선생님께 이야기해봐 💙
          </p>
        </div>
      </div>
    </div>
  )
}
