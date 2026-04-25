import { useEffect, useState } from 'react'

/**
 * 학교 전문상담교사 배치 현황 표시 컴포넌트
 *
 * 데이터 소스: public/data/counselor_info.json
 *  └ 출처: 학교알리미 2025년도 자격종별 교원 현황 (공공누리 1유형)
 *
 * NEIS school_code가 데이터셋에 없어서 학교명(school_name)으로 매칭한다.
 * 매칭 정확도를 높이기 위해 공백·괄호 제거 후 비교한다.
 */

// 학교명 정규화 (공백·괄호 제거)
function normalize(name) {
  return (name || '').replace(/[\s()（）]/g, '').toLowerCase()
}

export default function CounselorStatus({ schoolName, sidoName }) {
  const [data, setData] = useState(null)        // 매칭된 학교 정보
  const [sidoStat, setSidoStat] = useState(null) // 시도 평균 (참고)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!schoolName) {
      setLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/data/counselor_info.json')
        if (!res.ok) throw new Error('데이터 파일을 불러올 수 없어요')
        const json = await res.json()
        if (cancelled) return

        // 학교명으로 매칭 (정규화 후 부분 일치도 시도)
        const target = normalize(schoolName)
        let match = json['학교목록'].find(s => normalize(s['학교명']) === target)
        if (!match) {
          match = json['학교목록'].find(
            s => normalize(s['학교명']).includes(target) || target.includes(normalize(s['학교명']))
          )
        }
        if (match) setData(match)

        // 시도 평균 (학교가 있든 없든 표시)
        const sidoKey = match?.['시도'] || sidoName
        if (sidoKey && json['시도별통계'][sidoKey]) {
          setSidoStat({ name: sidoKey, ...json['시도별통계'][sidoKey] })
        }
      } catch (err) {
        console.error('CounselorStatus load error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolName, sidoName])

  if (loading) {
    return <div className="animate-pulse bg-gray-100 h-32 rounded-3xl" />
  }

  // ── 매칭된 학교가 있는 경우 ──────────────────────────────
  if (data) {
    // 데이터셋 키는 '상담교사배치' / '전문상담교사수'
    const placed = data['상담교사배치'] ?? data['전문상담교사배치']
    const count  = data['전문상담교사수'] ?? 0

    return (
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="text-xs text-gray-400 font-semibold mb-1">우리 학교 전문상담교사</p>
          <h3 className="text-base font-bold text-gray-800">{data['학교명']}</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">{data['지역']}</p>
        </div>

        {placed ? (
          <div className="mx-5 mb-5 bg-primary-50 border border-primary-100 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🧑‍🏫</span>
              <div className="flex-1">
                <p className="font-bold text-primary-700">전문상담교사 {count}명 배치</p>
                <p className="text-xs text-primary-700/80 mt-1 leading-relaxed">
                  우리학교에는 전문 상담 선생님이 계셔. 힘들땐 상담선생님을 찾아가보자
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-5 mb-5 bg-orange-50 border border-orange-100 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🍀</span>
              <div className="flex-1">
                <p className="font-bold text-orange-700">전문상담교사 미배치</p>
                <p className="text-xs text-orange-700/80 mt-1 leading-relaxed">
                  우리학교에는 전문 상담 선생님이 안계셔. 하지만 위클래스나 전문 상담선생님께 도움을 받을 수 있어!
                </p>
              </div>
            </div>
          </div>
        )}

        {sidoStat && (
          <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
            <p className="text-[10px] text-gray-400">{sidoStat.name} 평균 배치율 · 학교알리미 2025</p>
            <p className="text-xs font-semibold text-gray-600 mt-0.5">
              {sidoStat['배치율']} ({sidoStat['배치학교수']}/{sidoStat['전체학교수']}개교)
            </p>
          </div>
        )}
      </div>
    )
  }

  // ── 매칭 실패 ────────────────────────────────────────────
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs text-gray-400 font-semibold mb-1">우리 학교 전문상담교사</p>
      <h3 className="text-sm font-bold text-gray-700 mb-3">{schoolName || '학교 정보 없음'}</h3>
      <div className="bg-gray-50 rounded-2xl p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          학교알리미 데이터에서 매칭되는 학교를 찾지 못했어 😢<br />
          아래 1388 또는 Wee센터로 직접 도움을 받을 수 있어!
        </p>
      </div>
      {sidoStat && (
        <p className="text-[10px] text-gray-400 mt-3">
          {sidoStat.name} 평균 배치율 {sidoStat['배치율']} (학교알리미 2025)
        </p>
      )}
    </div>
  )
}
