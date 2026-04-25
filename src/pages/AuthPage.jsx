import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
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
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      {/* 로고 */}
      <div className="mb-10 text-center fade-up">
        <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-200">
          <span className="text-4xl">🐾</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">말동무</h1>
        <p className="text-xs text-gray-400 mt-1">말 못하는 마음을 대신 들어주는 친구</p>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-xs glass rounded-3xl p-6 shadow-lg shadow-gray-200/40 fade-up">
        {/* 탭 */}
        <div className="flex bg-gray-100/60 rounded-2xl p-1 mb-6">
          {['signup', 'login'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setMessage('') }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mode === m
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-400'
              }`}
            >
              {m === 'signup' ? '회원가입' : '로그인'}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3.5 rounded-2xl bg-white/80 border border-gray-200/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all"
          />
          <input
            type="password"
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3.5 rounded-2xl bg-white/80 border border-gray-200/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all"
          />

          {message && (
            <p className="text-xs text-center text-coral-500 px-2 whitespace-pre-wrap leading-relaxed">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl text-sm font-bold disabled:opacity-60 shadow-md shadow-primary-200 active:scale-[0.98] transition-all"
          >
            {loading ? '잠깐만...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>
      </div>

      <p className="text-[10px] text-gray-400 mt-8 text-center px-6">
        교육 공공데이터 AI활용 프로젝트
      </p>
    </div>
  )
}
