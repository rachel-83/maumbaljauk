import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/student/chat',   icon: '💬', label: '챗봇'   },
  { to: '/student/diary',  icon: '📔', label: '일기'   },
  { to: '/student/report', icon: '📊', label: '레포트' },
  { to: '/student/expert', icon: '🏥', label: '도우미' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] glass-strong shadow-[0_-2px_20px_rgba(0,0,0,0.06)] z-[100]">
      <div className="flex">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>{tab.icon}</span>
                <span className={`text-[10px] font-semibold ${isActive ? 'text-primary-600' : ''}`}>{tab.label}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-primary-500 mt-0.5" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
