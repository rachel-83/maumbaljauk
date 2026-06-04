import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function normalize(name) {
  return (name || '').replace(/[\s()（）]/g, '').toLowerCase()
}

export default function ExpertBanner() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [hasCounselor, setHasCounselor] = useState(null) // null=로딩, true/false

  useEffect(() => {
    if (!profile?.school_name) return
    fetch('/data/counselor_info.json')
      .then(r => r.json())
      .then(json => {
        const target = normalize(profile.school_name)
        const match = json['학교목록'].find(s => normalize(s['학교명']) === target)
          || json['학교목록'].find(s => normalize(s['학교명']).includes(target) || target.includes(normalize(s['학교명'])))
        setHasCounselor(match?.['상담교사배치'] ?? match?.['전문상담교사배치'] ?? false)
      })
      .catch(() => setHasCounselor(false))
  }, [profile?.school_name])

  if (hasCounselor === null) return null

  return (
    <button
      onClick={() => navigate(hasCounselor ? '/student/worry' : '/student/expert')}
      className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl text-left shadow-sm"
      aria-label="전문가 연결 탭으로 이동"
    >
      <span className="text-xl">{hasCounselor ? '🏫' : '🏥'}</span>
      <div className="flex-1">
        <p className="text-xs font-bold text-primary-600">
          {hasCounselor
            ? '우리 학교 상담선생님과 이야기 나눠봐'
            : '힘들면 전문가 도움을 받아봐'}
        </p>
        <p className="text-[10px] text-gray-500">
          {hasCounselor
            ? '학교 상담실 · Wee센터 · 1388'
            : 'Wee센터 · 청소년상담복지센터 · 1388'}
        </p>
      </div>
      <span className="text-primary-400 text-sm font-bold">→</span>
    </button>
  )
}
