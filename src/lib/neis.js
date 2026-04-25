/**
 * NEIS Open API 호출 헬퍼
 * https://open.neis.go.kr/portal/data/service/selectServicePage.do
 *
 * 학교 정보, 급식 메뉴, 학사일정 등 교육 공공데이터를 조회한다.
 * API 키는 선택사항이며 미설정 시에도 일부 엔드포인트는 동작한다(일일 호출량 제한).
 */

const NEIS_BASE = 'https://open.neis.go.kr/hub'
const KEY = import.meta.env.VITE_NEIS_API_KEY || ''

/** 오늘 날짜를 YYYYMMDD 형식 문자열로 반환 */
function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/** 이번 주 시작/종료 (월요일~일요일) YYYYMMDD 반환 */
function weekRangeYmd() {
  const d = new Date()
  const day = d.getDay() || 7   // 일요일=0 → 7로 보정
  const monday = new Date(d); monday.setDate(d.getDate() - (day - 1))
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const fmt = x => `${x.getFullYear()}${String(x.getMonth()+1).padStart(2,'0')}${String(x.getDate()).padStart(2,'0')}`
  return [fmt(monday), fmt(sunday)]
}

/** 공통 fetch 래퍼 */
async function neisFetch(endpoint, params) {
  const qs = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: '20', ...params })
  if (KEY) qs.set('KEY', KEY)
  const res = await fetch(`${NEIS_BASE}/${endpoint}?${qs}`)
  if (!res.ok) throw new Error(`NEIS API ${res.status}`)
  return res.json()
}

/** 학교 검색 (학교명으로) */
export async function searchSchools(query) {
  if (!query?.trim()) return []
  try {
    const data = await neisFetch('schoolInfo', { SCHUL_NM: query })
    return data?.schoolInfo?.[1]?.row ?? []
  } catch (e) {
    console.error('searchSchools error:', e)
    return []
  }
}

/** 오늘 급식 메뉴 조회 */
export async function getTodayMeal(sidoCode, schoolCode) {
  if (!sidoCode || !schoolCode) return null
  try {
    const data = await neisFetch('mealServiceDietInfo', {
      ATPT_OFCDC_SC_CODE: sidoCode,
      SD_SCHUL_CODE: schoolCode,
      MLSV_YMD: todayYmd(),
    })
    const row = data?.mealServiceDietInfo?.[1]?.row?.[0]
    if (!row) return null
    // <br/> 구분자 + 알레르기 번호(괄호) 제거
    return row.DDISH_NM
      .replace(/<br\/>/g, ', ')
      .replace(/\([0-9.,\s]+\)/g, '')
      .trim()
  } catch (e) {
    console.error('getTodayMeal error:', e)
    return null
  }
}

/** 이번 주 학사일정 조회 (이벤트명 배열) */
export async function getWeekSchedule(sidoCode, schoolCode) {
  if (!sidoCode || !schoolCode) return []
  try {
    const [from, to] = weekRangeYmd()
    const data = await neisFetch('SchoolSchedule', {
      ATPT_OFCDC_SC_CODE: sidoCode,
      SD_SCHUL_CODE: schoolCode,
      AA_FROM_YMD: from,
      AA_TO_YMD: to,
    })
    const rows = data?.SchoolSchedule?.[1]?.row ?? []
    return rows
      .map(r => r.EVENT_NM)
      .filter(e => e && e !== '토요휴업일' && e !== '공휴일')
  } catch (e) {
    console.error('getWeekSchedule error:', e)
    return []
  }
}

/**
 * 챗봇용 컨텍스트 문자열 생성
 * 급식과 학사일정을 한 번에 fetch하고, Claude 시스템 프롬프트에 주입할
 * 형태(`- 오늘 급식: ...\n- 이번 주 일정: ...`)로 가공해 반환한다.
 */
export async function buildSchoolContext(sidoCode, schoolCode) {
  if (!sidoCode || !schoolCode) return ''
  const [meal, schedule] = await Promise.all([
    getTodayMeal(sidoCode, schoolCode),
    getWeekSchedule(sidoCode, schoolCode),
  ])
  const lines = []
  if (meal) lines.push(`- 오늘 급식: ${meal}`)
  if (schedule.length > 0) lines.push(`- 이번 주 일정: ${schedule.slice(0, 3).join(', ')}`)
  return lines.join('\n')
}
