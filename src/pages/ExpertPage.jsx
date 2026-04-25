import { useState, lazy, Suspense } from 'react'
import { useAuth } from '../context/AuthContext'
import CounselorStatus from '../components/CounselorStatus'
const ShelterMap = lazy(() => import('../components/ShelterMap'))
const AnimalExperienceMap = lazy(() => import('../components/AnimalExperienceMap'))
const COUNSELING = [
  {
    name: '청소년 전화 1388',
    desc: '24시간 청소년 전문상담 (무료)',
    badge: '긴급',
    badgeColor: 'bg-red-100 text-red-600',
    icon: '📞',
    link: 'tel:1388',
    linkText: '전화하기',
  },
  {
    name: '정신건강 위기상담 전화',
    desc: '1577-0199 · 24시간 운영 · 무료',
    badge: '긴급',
    badgeColor: 'bg-red-100 text-red-600',
    icon: '🆘',
    link: 'tel:15770199',
    linkText: '전화하기',
  },
  {
    name: 'Wee센터',
    desc: '학교 내·외 학생 정서 전문상담 기관',
    badge: '학교연계',
    badgeColor: 'bg-blue-100 text-blue-600',
    icon: '🏫',
    link: 'https://www.wee.go.kr',
    linkText: '바로가기',
  },
  {
    name: '청소년상담복지센터',
    desc: '지역별 청소년 상담·복지 서비스 제공',
    badge: '지역상담',
    badgeColor: 'bg-green-100 text-green-600',
    icon: '🏢',
    link: 'https://www.kyci.or.kr',
    linkText: '바로가기',
  },
  {
    name: '정신건강복지센터',
    desc: '지역 정신건강 전문 서비스 (무료)',
    badge: '전문기관',
    badgeColor: 'bg-purple-100 text-purple-600',
    icon: '🏥',
    link: 'https://www.mentalhealth.go.kr',
    linkText: '바로가기',
  },
]

const ANIMALS = [
  {
    name: '반려동물 입양알아보기',
    desc: '전국 유기동물 입양 정보 조회',
    badge: '입양',
    badgeColor: 'bg-yellow-100 text-yellow-700',
    icon: '🐕',
    link: 'https://www.animal.go.kr/front/index.do',
    linkText: '바로가기',
  },
]

function ResourceCard({ name, desc, badge, badgeColor, icon, link, linkText }) {
  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm flex items-start gap-3">
      <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="text-sm font-bold text-gray-800">{name}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
      </div>
      <a
        href={link}
        target={link.startsWith('tel') ? '_self' : '_blank'}
        rel="noreferrer"
        className="flex-shrink-0 text-xs text-primary-600 font-bold bg-primary-50 px-3 py-1.5 rounded-xl whitespace-nowrap"
      >
        {linkText}
      </a>
    </div>
  )
}

export default function ExpertPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('animal') // 'animal' | 'counseling'

  const list = tab === 'counseling' ? COUNSELING : ANIMALS

  return (
    <div className="pb-32 px-4 pt-16 min-h-dvh">
      <h1 className="text-xl font-bold text-gray-800 mb-2">🐾 마음발자국 도우미</h1>
      <p className="text-xs text-gray-500 mb-5">반려동물과 전문상담 선생님의 도움을 받을 수 있어요</p>

      {/* 탭 전환 */}
      <div className="flex bg-white rounded-2xl p-1 mb-5 shadow-sm">
        {[
          { key: 'animal',     label: '🐾 반려동물 체험' },
          { key: 'counseling', label: '💬 상담 기관' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-primary-500 text-white' : 'text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      
      {/* 교내 전문상담 현황 / 지역 Wee센터 정보 */}
      {tab === 'counseling' && (
        <div className="mb-6">
          <CounselorStatus schoolName={profile?.school_name} />
        </div>
      )}

      {/* 카드 목록 */}
      <div className="space-y-3">
        {list.map((item, i) => (
          <ResourceCard key={i} {...item} />
        ))}
      </div>

      {tab === 'animal' && (
        <>
          {/* 반려동물 체험장소 지도 */}
          <Suspense fallback={
            <div className="mt-5 h-48 flex items-center justify-center bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-400 animate-pulse">체험장소 불러오는 중...</p>
            </div>
          }>
            <AnimalExperienceMap />
          </Suspense>

          {/* 동물보호센터 지도 */}
          <div className="mt-5 bg-white rounded-3xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🏠</span>
              <p className="text-sm font-bold text-gray-800">동물보호센터</p>
            </div>
            <p className="text-xs text-gray-500 mb-1">
              동물보호센터에서 반려동물을 입양할 수 있어요
            </p>
            <Suspense fallback={
              <div className="h-48 flex items-center justify-center bg-gray-50 rounded-2xl mt-3">
                <p className="text-xs text-gray-400 animate-pulse">지도 불러오는 중...</p>
              </div>
            }>
              <ShelterMap />
            </Suspense>

          </div>

          {/* 반려동물 체험 안내 */}
          <div className="mt-4 bg-[#FDF0EB] rounded-2xl p-4">
            <p className="text-xs text-coral-500 font-semibold mb-1">💡 반려동물 체험이 왜 도움이 될까?</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              동물과의 교감은 옥시토신(행복 호르몬) 분비를 촉진해서 스트레스와 불안을 낮춰줘.
              지역 동물보호센터 방문 봉사나 입양 체험 프로그램에 참여해봐!
            </p>
          </div>
        </>
      )}

      <div className="mt-6 bg-gray-50 rounded-2xl p-4">
        <p className="text-[10px] text-gray-400 text-center leading-relaxed">
          본 서비스는 정보 제공만을 목적으로 합니다.<br/>
          자동 진단·처방·상담 예약 기능은 제공하지 않습니다.
        </p>
      </div>
    </div>
  )
}
