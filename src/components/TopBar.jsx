import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function TopBar() {
  const { profile } = useAuth()
  if (!profile) return null

  const parts = []
  if (profile.grade)     parts.push(`${profile.grade}학년`)
  if (profile.class_num) parts.push(`${profile.class_num}반`)
  if (profile.role === 'student' && profile.student_num) {
    parts.push(`${profile.student_num}번`)
  } else if (profile.role === 'teacher') {
    parts.push('담임')
  }
  const classInfo = parts.join(' ')

  async function handleLogout() {
    if (!confirm('로그아웃 할까?')) return
    await supabase.auth.signOut()
  }

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] h-12 glass-strong z-[90] flex items-center justify-end gap-2 px-4 shadow-sm">
      <div className="text-right leading-tight min-w-0">
        <p className="text-[11px] font-bold text-gray-700 truncate max-w-[200px]">
          {profile.school_name || '학교 정보 없음'}
        </p>
        {classInfo && (
          <p className="text-[9px] text-primary-500 truncate max-w-[200px] font-semibold">{classInfo}</p>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="flex-shrink-0 text-[10px] text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full font-semibold active:scale-95 transition-transform"
        aria-label="로그아웃"
      >
        로그아웃
      </button>
    </div>
  )
}
