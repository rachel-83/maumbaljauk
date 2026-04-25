import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import WorryThread from '../components/WorryThread'

/**
 * 고민 털어놓기 — 학생 전용 페이지
 *
 * 흐름:
 *  - list: 내 고민 목록
 *  - compose: 새 고민 작성
 *  - thread: 특정 고민 + 선생님 대화 스레드
 *
 * 선생님 라우팅:
 *  - public/data/counselor_info.json 에서 본인 학교 상담교사 배치 여부 확인
 *  - 배치 O → target_type='counselor'
 *  - 배치 X → target_type='homeroom'
 */

function formatTime(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function normalizeSchool(name) {
  return (name || '').replace(/[\s()（）]/g, '').toLowerCase()
}

export default function WorryPage() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState('list') // list | compose | thread
  const [worries, setWorries] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])

  // 작성 폼
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // target_type 캐시 (학교 상담사 배치 여부에 따라)
  const [targetType, setTargetType] = useState('homeroom')

  // ── 학교 상담교사 배치 여부 확인 ──────────────────────────
  useEffect(() => {
    if (!profile?.school_name) return
    fetch('/data/counselor_info.json')
      .then(r => r.json())
      .then(json => {
        const target = normalizeSchool(profile.school_name)
        const match = json['학교목록'].find(
          s => normalizeSchool(s['학교명']) === target
        ) || json['학교목록'].find(
          s => normalizeSchool(s['학교명']).includes(target) || target.includes(normalizeSchool(s['학교명']))
        )
        const placed = match?.['상담교사배치'] ?? match?.['전문상담교사배치'] ?? false
        setTargetType(placed ? 'counselor' : 'homeroom')
      })
      .catch(err => console.error('counselor_info load:', err))
  }, [profile?.school_name])

  // ── 내 고민 목록 로드 ─────────────────────────────────────
  async function loadWorries() {
    if (!session) return
    const { data, error } = await supabase
      .from('worries')
      .select('*')
      .eq('student_id', session.user.id)
      .order('updated_at', { ascending: false })
    if (error) console.error('worries load:', error)
    setWorries(data || [])
  }

  useEffect(() => { loadWorries() }, [session])

  // ── 스레드 열기 ────────────────────────────────────────────
  async function openThread(worry) {
    setSelected(worry)
    setView('thread')
    const { data } = await supabase
      .from('worry_messages')
      .select('*')
      .eq('worry_id', worry.id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  // ── 새 고민 저장 ───────────────────────────────────────────
  async function handleSubmit() {
    if (!content.trim() || saving) return
    setSaving(true)
    setErrorMsg('')

    const { data, error } = await supabase
      .from('worries')
      .insert({
        student_id:  session.user.id,
        school_code: profile.school_code,
        grade:       profile.grade,
        class_num:   profile.class_num,
        target_type: targetType,
        title:       title.trim() || null,
        content:     content.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('worry insert:', error)
      setErrorMsg(`저장 실패: ${error.message}`)
      setSaving(false)
      return
    }

    setTitle('')
    setContent('')
    setSaving(false)
    await loadWorries()
    openThread(data)
  }

  // ── 목록 화면 ──────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="min-h-dvh pt-16 pb-24 px-4 bg-transparent">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-500 mb-4"
        >
          ← 뒤로
        </button>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-800">🤐 고민 털어놓기</h1>
            <p className="text-[10px] text-gray-400 mt-1">
              익명으로 전달돼 · 선생님도 네가 누구인지 몰라
            </p>
          </div>
          <button
            onClick={() => { setTitle(''); setContent(''); setErrorMsg(''); setView('compose') }}
            className="px-4 py-2 bg-primary-500 text-white text-xs font-bold rounded-2xl"
          >
            + 새 고민
          </button>
        </div>

        {/* 타겟 안내 */}
        <div className="mb-4 bg-primary-50 rounded-2xl p-3">
          <p className="text-[11px] text-primary-600 font-semibold">
            {targetType === 'counselor'
              ? '💬 우리 학교 전문상담선생님께 전달돼'
              : '💬 담임선생님께 전달돼'}
          </p>
        </div>

        {worries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-gray-400 py-16">
            <span className="text-5xl">🙊</span>
            <p className="text-sm text-center leading-relaxed">
              아직 털어놓은 고민이 없어<br />
              혼자 끙끙 앓지 말고 얘기해봐
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {worries.map(w => (
              <button
                key={w.id}
                onClick={() => openThread(w)}
                className="w-full text-left bg-white rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-gray-400">
                    {formatTime(w.updated_at)} ·
                    {w.target_type === 'counselor' ? ' 상담선생님' : ' 담임선생님'}
                  </p>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                    w.status === 'open' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {w.status === 'open' ? '대화 중' : '종료'}
                  </span>
                </div>
                {w.title && <p className="text-sm font-bold text-gray-800 mb-1">{w.title}</p>}
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{w.content}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── 작성 화면 ──────────────────────────────────────────────
  if (view === 'compose') {
    return (
      <div className="min-h-dvh pt-16 pb-24 px-4 bg-transparent">
        <button onClick={() => setView('list')} className="text-sm text-gray-500 mb-5">
          ← 취소
        </button>

        <h2 className="text-lg font-bold text-gray-800 mb-1">🤐 속마음 털어놓기</h2>
        <p className="text-xs text-gray-500 mb-5">
          익명으로 전달돼. 선생님은 네가 누구인지 알 수 없어.
        </p>

        <div className="bg-primary-50 rounded-2xl p-3 mb-5">
          <p className="text-[11px] text-primary-600 font-semibold leading-relaxed">
            {targetType === 'counselor'
              ? '💬 우리 학교 전문상담선생님께 전달됩니다'
              : '💬 담임선생님께 전달됩니다 (우리 학교엔 전문상담교사가 없어)'}
          </p>
        </div>

        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={30}
          placeholder="제목 (선택)"
          className="w-full p-4 mb-3 bg-white rounded-2xl border-0 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-300/20 shadow-sm"
        />

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="무슨 일이 있었어? 어떤 기분이야? 편하게 얘기해도 돼..."
          className="w-full min-h-[220px] p-4 bg-white rounded-3xl border-0 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-300/20 resize-none shadow-sm"
        />

        {errorMsg && <p className="text-xs text-coral-500 mt-3 text-center whitespace-pre-wrap">{errorMsg}</p>}

        <button
          onClick={handleSubmit}
          disabled={!content.trim() || saving}
          className="mt-5 w-full py-4 bg-primary-500 text-white rounded-2xl text-sm font-bold disabled:opacity-40 shadow-sm"
        >
          {saving ? '전달 중...' : '선생님께 전달하기'}
        </button>
      </div>
    )
  }

  // ── 스레드 화면 ────────────────────────────────────────────
  const teacherLabel = selected?.target_type === 'counselor' ? '상담선생님' : '담임선생님'

  async function handleThreadReply(content, replyToId) {
    const row = {
      worry_id: selected.id,
      sender_role: 'student',
      sender_id: session.user.id,
      content,
    }
    if (replyToId) row.reply_to = replyToId
    const { data } = await supabase.from('worry_messages').insert(row).select().single()
    if (data) setMessages(prev => [...prev, data])
  }

  return (
    <WorryThread
      worry={selected}
      messages={messages}
      viewerRole="student"
      viewerLabel="나"
      otherLabel={teacherLabel}
      onSendReply={handleThreadReply}
      onBack={() => setView('list')}
      onRefresh={() => openThread(selected)}
    />
  )
}
