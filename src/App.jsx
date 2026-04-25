import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
import ChatPage from './pages/ChatPage'
import DiaryPage from './pages/DiaryPage'
import ReportPage from './pages/ReportPage'
import ExpertPage from './pages/ExpertPage'
import WorryPage from './pages/WorryPage'
import TeacherDashboard from './pages/TeacherDashboard'
import BottomNav from './components/BottomNav'
import TopBar from './components/TopBar'
import FloatingChatButton from './components/FloatingChatButton'

function AppRoutes() {
  const { session, profile } = useAuth()

  // 로딩 중
  if (session === undefined) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-4xl animate-bounce">🐾</div>
      </div>
    )
  }

  // 비로그인
  if (!session) return <AuthPage />

  // 프로필 로딩 중 (session은 있지만 profile fetch 진행 중)
  if (!profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-4xl animate-bounce">🐾</div>
      </div>
    )
  }

  // 온보딩 미완료 OR v1.0.0 → v1.1.0 마이그레이션 (school_code 없는 사용자)
  if (!profile.onboarding_done || !profile.school_code) return <OnboardingPage />

  // 학생인데 학년/반/번호 누락 시 학교 정보 재입력
  if (profile.role === 'student' && (!profile.grade || !profile.class_num || !profile.student_num)) return <OnboardingPage />

  // 교사 라우팅
  if (profile.role === 'teacher') {
    return (
      <div className="relative">
        <TopBar />
        <Routes>
          <Route path="/" element={<Navigate to="/teacher" replace />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="*" element={<Navigate to="/teacher" replace />} />
        </Routes>
      </div>
    )
  }

  // 학생 메인 앱
  return (
    <div className="relative">
      <TopBar />
      <Routes>
        <Route path="/" element={<Navigate to="/student/chat" replace />} />
        <Route path="/student/chat"   element={<ChatPage />} />
        <Route path="/student/diary"  element={<DiaryPage />} />
        <Route path="/student/report" element={<ReportPage />} />
        <Route path="/student/expert" element={<ExpertPage />} />
        <Route path="/student/worry"  element={<WorryPage />} />
        <Route path="*"               element={<Navigate to="/student/chat" replace />} />
      </Routes>
      <FloatingChatButton />
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
