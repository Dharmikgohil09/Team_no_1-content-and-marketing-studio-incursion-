import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'

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

          {/* Project name */}
          {project && (
            <div className="shrink-0 hidden lg:flex items-center gap-2">
              <span className="text-xs text-muted">Project:</span>
              <span className="text-xs font-medium text-ink max-w-32 truncate">{project.name}</span>
            </div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-[1120px] w-full mx-auto px-8 py-10 animate-fade-in">
        <Outlet />
      </main>
    </div>
  )
}
