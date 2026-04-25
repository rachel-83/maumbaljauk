import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchProfile(data.session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) fetchProfile(s.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    let { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    // 프로필 행이 없으면 자동 생성 (테이블 생성 전 가입한 사용자 대응)
    if (!data) {
      const { data: created } = await supabase
        .from('users')
        .insert({ id: userId })
        .select()
        .single()
      data = created
    }

    setProfile(data)
  }

  async function updateProfile(updates) {
    if (!session) return
    const { data } = await supabase
      .from('users')
      .update(updates)
      .eq('id', session.user.id)
      .select()
      .single()
    setProfile(data)
    return data
  }

  return (
    <AuthContext.Provider value={{ session, profile, updateProfile, fetchProfile: () => fetchProfile(session?.user?.id) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
