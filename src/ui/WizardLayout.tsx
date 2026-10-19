import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { useAuthStore } from '../store/authStore'
import { AUTH_CONFIG } from '../config/auth'

const STEPS = [
  { id: 'describe', label: 'Describe',  icon: '✦', path: '/studio/describe'  },
  { id: 'clarify',  label: 'Clarify',   icon: '◈', path: '/studio/clarify'  },
  { id: 'drafts',   label: 'Drafts',    icon: '◉', path: '/studio/drafts'   },
  { id: 'editor',   label: 'Editor',    icon: '◌', path: '/studio/editor'   },
  { id: 'data',     label: 'Data',      icon: '▦', path: '/studio/data'     },
  { id: 'export',   label: 'Export',    icon: '▲', path: '/studio/export'   },
]

export function WizardLayout() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const project    = useProjectStore(s => s.project)
  const user       = useAuthStore(s => s.user)
  const profile    = useAuthStore(s => s.profile)
  const signOut    = useAuthStore(s => s.signOut)
  const step       = project?.wizardStep ?? 0

  const currentIdx = STEPS.findIndex(s => location.pathname.includes(s.id))

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-line bg-bg">
        <div className="max-w-[1120px] mx-auto px-8 h-[76px] flex items-center gap-6">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 shrink-0 group text-left"
          >
            <div className="w-[36px] h-[36px] rounded-[8px] bg-accent flex items-center justify-center shrink-0">
              <span className="text-white font-semibold text-[12px] leading-none">EC</span>
            </div>
            <div className="flex flex-col leading-[1.15]">
              <span className="font-semibold text-[17px] text-ink">Event</span>
              <span className="font-semibold text-[17px] text-ink">Canvas</span>
            </div>
          </button>

          {/* Stepper */}
          <nav className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar py-1 justify-center">
            {STEPS.map((s, idx) => {
              const isActive   = idx === currentIdx
              const isComplete = idx < currentIdx
              // Forward navigation in the stepper is blocked until input on the current page is submitted
              const isReachable = idx < currentIdx

              return (
                <div key={s.id} className="flex items-center gap-1 shrink-0">
                  {/* Line before */}
                  {idx > 0 && (
                    <div className={`w-6 h-px transition-all duration-300 ${isComplete ? 'bg-accent' : 'bg-line'}`} />
                  )}

                  <button
                    onClick={() => isReachable && navigate(s.path)}
                    disabled={!isReachable}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                      ${isActive
                        ? 'bg-accent text-white shadow-none'
                        : isComplete
                        ? 'text-ink hover:text-accent hover:bg-hover-surface cursor-pointer'
                        : 'text-muted/60 cursor-not-allowed'
                      }
                    `}
                  >
                    <span className="opacity-80">{s.icon}</span>
                    <span className="hidden md:inline">{s.label}</span>
                  </button>
                </div>
              )
            })}
          </nav>

          {/* User profile & Logout */}
          <div className="shrink-0 flex items-center gap-3">
            {project && (
              <div className="hidden xl:flex items-center gap-1.5 text-xs">
                <span className="text-muted">Project:</span>
                <span className="font-medium text-ink max-w-28 truncate">{project.name}</span>
              </div>
            )}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-line">
                <span className="text-xs text-ink font-medium max-w-32 truncate hidden sm:inline" title={profile?.full_name || user.email || ''}>
                  {profile?.full_name || user.email?.split('@')[0]}
                </span>
                <button
                  id="wizard-logout-btn"
                  type="button"
                  onClick={async () => {
                    await signOut()
                    navigate(AUTH_CONFIG.routes.login)
                  }}
                  className="text-xs py-1 px-2.5 rounded-md border border-line hover:border-line-strong text-muted hover:text-ink transition-colors cursor-pointer"
                  title="Sign out of EventCanvas"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-[1120px] w-full mx-auto px-8 py-10 animate-fade-in">
        <Outlet />
      </main>
    </div>
  )
}
