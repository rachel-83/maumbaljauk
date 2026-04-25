/**
 * Claude API 호출 헬퍼 (프록시 없이 직접 호출)
 * ⚠️ 프로토타입 전용 — 프로덕션에서는 서버사이드 프록시를 통해 API 키를 숨기세요.
 */

const API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'
const BASE_URL = 'https://api.anthropic.com/v1/messages'

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * @param {string} systemPrompt
 * @param {Array<{role:'user'|'assistant', content:string}>} messages
 * @param {number} maxTokens
 * @returns {Promise<string>}
 */
export async function callClaude(systemPrompt, messages, maxTokens = 512) {
  const MAX_RETRIES = 3
  let lastError

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000) // 30초 타임아웃

    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        }),
      })

      if (res.status === 529 || res.status === 503) {
        // 과부하 — 지수 백오프 후 재시도
        const delay = (attempt + 1) * 2000
        await sleep(delay)
        lastError = new Error('잠시 후 다시 시도해줘! (서버가 바빠)')
        continue
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `API 오류 ${res.status}`)
      }

      const data = await res.json()
      return data.content[0].text
    } catch (e) {
      if (e.name === 'AbortError') throw e // 타임아웃은 바로 throw
      lastError = e
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError
}

// ── 챗봇 시스템 프롬프트 ─────────────────────────────────────
export function buildChatSystemPrompt(petName, petType, context = '', schoolName = '') {
  const types = { dog: '강아지', cat: '고양이', rabbit: '토끼', bear: '곰' }
  const animal = types[petType] || '강아지'
  const now = new Date()
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const todayStr = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${dayNames[now.getDay()]}요일`
  return `너는 공감 능력이 뛰어난 ${animal} 친구 ${petName}야. 중학생 친구의 감정 고민을 들어주는 반려동물 AI야.

[오늘 날짜] ${todayStr}
[친구 학교] ${schoolName || '알 수 없음'}

규칙:
1. 먼저 친구의 감정을 인정하고 공감해줘.
2. 상대방 입장을 제3자 시각에서 부드럽게 해석해줘.
3. 구체적이고 실천 가능한 대화 방법을 1~2가지 제안해줘.
4. 답변은 3~5문장, 중학생 눈높이의 친근한 반말로 작성해줘.
5. 이모지를 1~2개 적절히 사용해줘.
6. 위기 신호(자해, 자살, 극단적 표현)가 보이면 반드시 "힘들면 1388에 전화해봐, 언제든 들어줘 💙" 라고 안내해줘.
7. 날짜나 요일을 물어보면 위의 [오늘 날짜] 정보를 기준으로 정확하게 답해줘.
8. 학교를 물어보면 [친구 학교] 정보를 기준으로 답해줘.
9. 급식, 시간표, 학사일정은 [오늘 컨텍스트]에 있을 때만 답하고, 없으면 "시간표나 급식 정보를 잘 모르겠어"라고 솔직하게 말해줘.
10. 응답 마지막에 감정 태그를 JSON으로 추가해줘: [TAGS: {"tags":["감정1","감정2"]}]

${context ? `[오늘 컨텍스트]\n${context}\n\n위 컨텍스트에 있는 시간표, 급식, 학사일정 정보를 바탕으로 학생이 관련 질문을 하면 정확히 알려주고, 대화 중 자연스럽게 활용해줘.` : ''}`
}

// ── 일기 분석 프롬프트 ───────────────────────────────────────
export const DIARY_SYSTEM_PROMPT = `너는 청소년 감정 일기를 분석하는 공감 AI야.
입력된 일기와 기분 이모지를 보고 아래 JSON 형식으로만 응답해.
마크다운 코드블록 없이, JSON 오브젝트만 출력해.

{"summary":"오늘 감정 1문장(30자 이내)","feedback":"공감 피드백 2문장(60자 이내)","tags":["감정1","감정2","감정3"]}

규칙: 판단하지 말고 공감 우선. tags는 감정 단어만.`

/**
 * Claude 응답에서 JSON을 안전하게 파싱 (마크다운 코드블록 처리 포함)
 */
export function parseJsonSafe(raw) {
  // 마크다운 코드블록 제거: ```json ... ``` 또는 ``` ... ```
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  // 첫 { 부터 마지막 } 까지 추출
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1)
  return JSON.parse(text)
}

// ── 주간 레포트 격려 메시지 ──────────────────────────────────
export const REPORT_SYSTEM_PROMPT = `너는 중학생에게 따뜻한 격려 한마디를 건네는 AI야.
아래 규칙을 반드시 지켜:
1. 딱 1~2문장만 출력해. 그 이상 쓰지 마.
2. 점수·숫자·분석 내용·데이터는 절대 포함하지 마.
3. 제목·헤더·목록 기호·마크다운 없이 순수 텍스트만 써.
4. 친근한 반말로, 이모지 1개만 포함해.
5. 이번 주 감정 흐름을 바탕으로 진심 어린 응원 한마디만 해줘.`

// ── 주간 종합 분석 프롬프트 ─────────────────────────────────
export const WEEKLY_ANALYSIS_PROMPT = `너는 청소년 감정 데이터를 종합 분석하는 전문 상담 AI야.
아래 데이터를 바탕으로 이번 주 감정 종합 리포트를 작성해줘.

작성 규칙:
1. 중학생 눈높이의 따뜻하고 친근한 반말로 작성해.
2. 다음 4개 항목을 순서대로, 각각 1~2문장씩 작성해:
   ① 이번 주 감정 흐름 요약 (어떤 감정이 많았는지)
   ② 일기·대화에서 보이는 주요 관심사나 상황 (긍정/부정 단어 기반)
   ③ 잘한 점 또는 긍정적인 변화 (칭찬·격려)
   ④ 다음 주를 위한 따뜻한 조언 한 가지
3. 이모지를 적절히 사용해 (각 항목에 1개).
4. 판단하거나 평가하지 말고 공감 위주로 작성해.
5. 전체 200자 이내로 간결하게.`
