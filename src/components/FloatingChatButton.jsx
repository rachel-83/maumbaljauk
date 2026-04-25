import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * 화면 우측 하단 고정 챗봇 플로팅 버튼.
 * - 캐릭터의 감정 표정 이미지 표시 (/assets/characters/{pet}_{mood}.png)
 * - 클릭 시 챗봇 화면(/student/chat)으로 이동
 * - 사용자의 최근 일기 mood_emoji 기준으로 표정 자동 갱신
 */

const MOOD_TO_EXPRESSION = {
  '😊': 'happy',   // 기쁨/밝음
  '😐': 'normal',  // 보통
  '😔': 'sad',     // 슬픔
  '😠': 'angry',   // 화남
  '😰': 'sad',     // 불안 → sad에 매핑
}

export default function FloatingChatButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile } = useAuth()
  const [expression, setExpression] = useState('normal')
  const [imgError, setImgError] = useState(false)

  const petType = profile?.pet_type || 'dog'
  const [imgIdx, setImgIdx] = useState(0)  // 0=표정별, 1=기본, 2=이모지

  // 챗봇 화면에서는 숨김 (이미 챗봇 안에 있으므로)
  const isOnChatPage = location.pathname === '/student/chat'

  useEffect(() => {
    if (!session) return
    // 최근 일기의 mood_emoji 가져와서 표정 결정
    supabase
      .from('diary')
      .select('mood_emoji')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const recent = data?.[0]?.mood_emoji
        if (recent && MOOD_TO_EXPRESSION[recent]) {
          setExpression(MOOD_TO_EXPRESSION[recent])
        }
      })
  }, [session, location.pathname]) // 페이지 이동 시 재조회

  // 표정 변경 시 이미지 인덱스 리셋 (다시 표정별 이미지 시도)
  useEffect(() => { setImgIdx(0); setImgError(false) }, [expression, petType])

  if (!profile || isOnChatPage) return null

  // 폴백 순서: 표정별 → 기본 → 이모지
  const imgCandidates = [
    `/assets/characters/${petType}_${expression}.png`,
    `/assets/characters/${petType}.png`,
  ]
  const imgSrc = imgCandidates[imgIdx]

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-[420px] pointer-events-none z-[105]"
      style={{ bottom: 0, height: 0 }}
    >
      <button
        onClick={() => navigate('/student/chat')}
        className="absolute pointer-events-auto active:scale-95 transition-transform"
        style={{
          right: 20,
          bottom: 80, // BottomNav(56px) + 여백
          width: 60,
          height: 60,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 6px 20px rgba(74, 125, 232, 0.35)',
          border: '2px solid white',
          background: '#EEF4FF',
        }}
        aria-label="챗봇 열기"
      >
      {imgError ? (
        <span className="w-full h-full flex items-center justify-center text-2xl">🐾</span>
      ) : (
        <img
          key={imgSrc}
          src={imgSrc}
          alt="챗봇"
          onError={() => {
            // 다음 폴백 후보로 이동, 다 실패하면 이모지
            if (imgIdx + 1 < imgCandidates.length) setImgIdx(imgIdx + 1)
            else setImgError(true)
          }}
          className="w-full h-full object-cover"
          style={{
            opacity: 0,
            animation: 'fadeUp 0.3s ease forwards',
          }}
        />
      )}
      </button>
    </div>
  )
}
