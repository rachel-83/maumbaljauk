import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'https://maumbaljauk.vercel.app' },
      })
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already been registered'))
          setMessage('이미 가입된 이메일이에요. 로그인해줘 😊')
        else if (error.message.includes('invalid'))
          setMessage('올바른 이메일 형식으로 입력해줘!')
        else if (error.message.includes('weak') || error.message.includes('password'))
          setMessage('비밀번호는 6자 이상이어야 해!')
        else
          setMessage(`오류: ${error.message}`)
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMessage('이미 가입된 이메일이에요. 로그인해줘 😊')
      } else if (data.session) {
        // 바로 로그인
      } else {
        setMessage('📬 가입 확인 이메일을 보냈어! 메일함을 확인해줘.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Invalid login') || error.message.includes('invalid'))
          setMessage('이메일 또는 비밀번호가 틀렸어요 😢')
        else if (error.message.includes('Email not confirmed'))
          setMessage('이메일 인증이 필요해요.')
        else
          setMessage(`오류: ${error.message}`)
      }
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #e8e4f8 0%, #f0eaff 40%, #fce4ec 100%)' }}
    >
      {/* 배경 장식 원 */}
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #b39ddb, transparent)', transform: 'translate(-30%, -30%)' }} />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #f48fb1, transparent)', transform: 'translate(30%, 30%)' }} />

      {/* 로고 영역 */}
      <div className="mb-8 text-center relative">
        {/* 장식 이모지 */}
        <span className="absolute text-lg" style={{ top: -8, left: -24, opacity: 0.7 }}>💜</span>
        <span className="absolute text-sm" style={{ top: 0, right: -20, opacity: 0.6 }}>✦</span>
        <span className="absolute text-base" style={{ top: 20, left: -32, opacity: 0.5 }}>✦</span>
        <span className="absolute text-lg" style={{ top: 4, right: -30, opacity: 0.7 }}>🩷</span>
        <span className="absolute text-sm" style={{ bottom: 20, left: -16, opacity: 0.5 }}>✨</span>
        <span className="absolute text-sm" style={{ bottom: 16, right: -14, opacity: 0.6 }}>✨</span>

        {/* 아이콘 */}
        <div className="w-24 h-24 mx-auto mb-4">
          <img
            src="/assets/paw_icon.png"
            alt="마음발자국 아이콘"
            className="w-full h-full object-contain drop-shadow-xl"
          />
        </div>

        <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">마음발자국</h1>
        <p className="text-sm text-gray-500 mt-1.5">AI펫과 편하게 대화해봐</p>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-sm bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-purple-100/60">
        {/* 탭 */}
        <div className="flex bg-gray-100/70 rounded-2xl p-1 mb-6 gap-1">
          {[
            { key: 'signup', label: '회원가입', icon: '🐾' },
            { key: 'login',  label: '로그인',   icon: '🐱' },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => { setMode(m.key); setMessage('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mode === m.key
                  ? 'bg-white text-primary-600 shadow-md'
                  : 'text-gray-400'
              }`}
            >
              <span>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 이메일 */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 gap-3 focus-within:ring-2 focus-within:ring-primary-300 transition-all">
            <span className="text-gray-400 text-base flex-shrink-0">✉️</span>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
          </div>

          {/* 비밀번호 */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 gap-3 focus-within:ring-2 focus-within:ring-primary-300 transition-all">
            <span className="text-gray-400 text-base flex-shrink-0">🔒</span>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="text-gray-400 text-base flex-shrink-0"
            >
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>

          {message && (
            <p className="text-xs text-center text-coral-500 px-2 whitespace-pre-wrap leading-relaxed">{message}</p>
          )}

          {/* 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-60 active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, #7e57c2 0%, #9575cd 100%)', boxShadow: '0 4px 16px rgba(126,87,194,0.4)' }}
          >
            {loading ? '잠깐만...' : mode === 'login' ? (
              <><span>대화하러가기</span><span className="text-lg">🐾</span></>
            ) : (
              <><span>가입하기</span><span className="text-lg">✨</span></>
            )}
          </button>
        </form>
      </div>

      {/* 하단 캐릭터 */}
      <div className="flex flex-col items-center mt-6 w-full max-w-sm px-4">
        <img
          src="/assets/dogandcat.png"
          alt="강아지와 고양이"
          className="w-full object-contain drop-shadow-md"
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-base">🐾</span>
          <span className="text-gray-400 text-[10px] font-medium">교육 공공데이터 AI활용 프로젝트</span>
          <span className="text-base">🐾</span>
        </div>
      </div>
    </div>
  )
}
