import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import RoleSelector from '../components/RoleSelector'
import SchoolSelector from '../components/SchoolSelector'

const PETS = [
  { type: 'dog',    img: '/assets/characters/dog.png',    label: '강아지', defaultName: '멍멍이' },
  { type: 'cat',    img: '/assets/characters/cat.png',    label: '고양이', defaultName: '냥냥이' },
  { type: 'rabbit', img: '/assets/characters/rabbit.png', label: '토끼',   defaultName: '토순이' },
  { type: 'bear',   img: '/assets/characters/bear.png',   label: '곰',     defaultName: '곰돌이' },
]

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const MOODS = [
  { index: 0, emoji: '😊', label: '기쁨' },
  { index: 1, emoji: '😐', label: '보통' },
  { index: 2, emoji: '😔', label: '슬픔' },
]

export default function OnboardingPage() {
  const { session, fetchProfile, profile } = useAuth()

  // 이미 역할이 정해진 사용자(학번 누락 재진입)는 학교 입력 단계부터 시작
  const existingRole = profile?.role && profile.onboarding_done ? profile.role : null

  // Steps: 0=Role, 1=School, 2=Character, 3=Mood
  const [step, setStep] = useState(existingRole ? 1 : 0)
  const [role, setRole] = useState(existingRole)
  
  // School Data
  const [schoolData, setSchoolData] = useState(null)

  // Pet Data
  const [selectedPet, setSelectedPet] = useState(null)
  const [petName, setPetName] = useState('')
  
  // Mood Data
  const [seeds, setSeeds] = useState({})
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  function handleRoleSelect(selectedRole) {
    setRole(selectedRole)
    setStep(1)
  }

  function handleSchoolSelect(data) {
    setSchoolData(data)
    if (role === 'teacher') {
      handleTeacherFinish(data)
    } else {
      setStep(2)
    }
  }

  function handlePetSelect(pet) {
    setSelectedPet(pet)
    setPetName(pet.defaultName)
  }

  function handleSeedMood(dayOffset, moodIndex) {
    setSeeds(prev => ({ ...prev, [dayOffset]: moodIndex }))
  }

  async function handleTeacherFinish(schoolInfo) {
    setSaving(true)
    setErrorMsg('')
    const uid = session.user.id
    const { error } = await supabase.from('users').update({
      role: 'teacher',
      sido_code: schoolInfo.sido_code,
      school_code: schoolInfo.school_code,
      school_name: schoolInfo.school_name,
      grade: schoolInfo.grade,
      class_num: schoolInfo.class_num,
      onboarding_done: true,
    }).eq('id', uid)

    if (error) {
      console.error('Supabase update error:', error)
      setErrorMsg(`저장 실패: ${error.message}\n\nSupabase에서 v1.1.0 마이그레이션 SQL을 먼저 실행해줘.`)
      setSaving(false)
      return
    }

    await fetchProfile()
    setSaving(false)
  }

  async function handleStudentFinish(skip = false) {
    if (!selectedPet) {
      setErrorMsg('반려동물 캐릭터가 선택되지 않았어. 이전 단계로 돌아가서 골라줘!')
      return
    }
    setSaving(true)
    setErrorMsg('')

    const uid = session.user.id

    const { error } = await supabase.from('users').update({
      role: 'student',
      sido_code:   schoolData?.sido_code,
      school_code: schoolData?.school_code,
      school_name: schoolData?.school_name,
      grade:       schoolData?.grade,
      class_num:   schoolData?.class_num,
      student_num: schoolData?.student_num,
      pet_type: selectedPet.type,
      pet_name: petName || selectedPet.defaultName,
      onboarding_done: true,
    }).eq('id', uid)

    if (error) {
      console.error('Supabase update error:', error)
      setErrorMsg(`저장 실패: ${error.message}\n\nSupabase에서 v1.1.0 마이그레이션 SQL을 실행해줘.`)
      setSaving(false)
      return
    }

    if (!skip && Object.keys(seeds).length > 0) {
      const rows = Object.entries(seeds).map(([offset, moodIndex]) => ({
        user_id: uid,
        day_offset: Number(offset),
        mood_index: moodIndex,
      }))
      await supabase.from('mood_seeding').upsert(rows, { onConflict: 'user_id,day_offset' })
    }

    await fetchProfile()
    setSaving(false)
  }

  const totalSteps = role === 'teacher' ? 2 : 4

  return (
    <div className="min-h-dvh flex flex-col px-6 py-10 bg-transparent">
      {/* 진행 바 */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${step >= i ? 'bg-primary-600' : 'bg-gray-200'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center fade-up">
          <RoleSelector role={role} onRoleSelect={handleRoleSelect} />
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 flex flex-col fade-up">
          <SchoolSelector
            onSelect={handleSchoolSelect}
            role={role}
          />
          {errorMsg && (
            <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200">
              <p className="text-xs text-red-600 whitespace-pre-wrap leading-relaxed">{errorMsg}</p>
            </div>
          )}
          <button
            onClick={() => setStep(0)}
            className="mt-4 text-gray-500 text-sm font-medium underline"
          >
            뒤로 가기
          </button>
        </div>
      )}

      {step === 2 && role === 'student' && (
        <div className="flex-1 flex flex-col fade-up">
          <h2 className="text-xl font-bold text-gray-800 mb-1">나의 반려동물 친구를 골라봐!</h2>
          <p className="text-sm text-gray-500 mb-8">같이 대화할 친구야 🐾</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {PETS.map(pet => (
              <button
                key={pet.type}
                onClick={() => handlePetSelect(pet)}
                className={`aspect-square rounded-3xl border-3 overflow-hidden transition-all ${
                  selectedPet?.type === pet.type
                    ? 'border-primary-500 shadow-lg shadow-primary-200 scale-[1.03]'
                    : 'border-transparent'
                }`}
              >
                <img src={pet.img} alt={pet.label} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {selectedPet && (
            <div className="mb-8 fade-up">
              <label className="text-sm font-semibold text-gray-600 mb-2 block">
                <img src={selectedPet.img} alt="" className="w-5 h-5 inline-block mr-1" /> 이름을 지어줘!
              </label>
              <input
                type="text"
                value={petName}
                onChange={e => setPetName(e.target.value)}
                maxLength={10}
                placeholder={selectedPet.defaultName}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-primary-600"
              />
            </div>
          )}

          <div className="mt-auto flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="w-1/3 py-4 bg-gray-200 text-gray-700 rounded-2xl text-sm font-bold"
            >
              이전
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!selectedPet}
              className="flex-1 py-4 bg-primary-600 text-white rounded-2xl text-sm font-bold disabled:opacity-40"
            >
              다음 →
            </button>
          </div>
        </div>
      )}

      {step === 3 && role === 'student' && (
        <div className="flex-1 flex flex-col fade-up">
          <h2 className="text-xl font-bold text-gray-800 mb-1">지난 7일 기분은 어땠어?</h2>
          <p className="text-sm text-gray-500 mb-8">이모지로 간단하게 골라봐 (선택사항이야)</p>

          <div className="space-y-3 mb-8">
            {DAYS.map((day, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 text-sm text-gray-500 font-semibold">{day}</span>
                <div className="flex gap-2 flex-1">
                  {MOODS.map(m => (
                    <button
                      key={m.index}
                      onClick={() => handleSeedMood(i, m.index)}
                      className={`flex-1 py-2 rounded-2xl border-2 text-xl transition-all ${
                        seeds[i] === m.index
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      {m.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="mb-3 p-3 rounded-2xl bg-red-50 border border-red-200">
              <p className="text-xs text-red-600 whitespace-pre-wrap leading-relaxed">{errorMsg}</p>
            </div>
          )}

          <div className="space-y-3 mt-auto">
            <button
              onClick={() => handleStudentFinish(false)}
              disabled={saving}
              className="w-full py-4 bg-primary-600 text-white rounded-2xl text-sm font-bold disabled:opacity-60"
            >
              {saving ? '저장 중...' : '완료! 말동무 시작하기 🐾'}
            </button>
            <button
              onClick={() => handleStudentFinish(true)}
              disabled={saving}
              className="w-full py-3 text-gray-400 text-sm"
            >
              건너뛰기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
