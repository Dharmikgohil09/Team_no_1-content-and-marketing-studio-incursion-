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
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-surface-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 shrink-0 group"
          >
            <div className="w-8 h-8 rounded-lg bg-acm-600 flex items-center justify-center
                            group-hover:bg-acm-500 transition-colors shadow-glow-acm">
              <span className="text-white font-bold text-xs">CMS</span>
            </div>
            <span className="font-display font-semibold text-sm text-white hidden sm:block">
              Content Studio
            </span>
          </button>

          {/* Stepper */}
          <nav className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar py-1">
            {STEPS.map((s, idx) => {
              const isActive   = idx === currentIdx
              const isComplete = idx < currentIdx
              const isReachable = idx <= Math.max(step, currentIdx + 1)

              return (
                <div key={s.id} className="flex items-center gap-1 shrink-0">
                  {/* Line before */}
                  {idx > 0 && (
                    <div className={`w-6 h-px transition-all duration-500 ${isComplete ? 'bg-acm-500' : 'bg-white/10'}`} />
                  )}

                  <button
                    onClick={() => isReachable && navigate(s.path)}
                    disabled={!isReachable}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                      ${isActive
                        ? 'bg-acm-600/30 text-acm-300 border border-acm-500/40 shadow-glow-acm'
                        : isComplete
                        ? 'text-acm-400 hover:text-acm-300 hover:bg-acm-600/20 cursor-pointer'
                        : isReachable
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] cursor-pointer'
                        : 'text-slate-600 cursor-not-allowed'
                      }
                    `}
                  >
                    <span className="opacity-70">{s.icon}</span>
                    <span className="hidden md:inline">{s.label}</span>
                  </button>
                </div>
              )
            })}
          </nav>

          {/* Project name */}
          {project && (
            <div className="shrink-0 hidden lg:flex items-center gap-2">
              <span className="text-xs text-slate-500">Project:</span>
              <span className="text-xs font-medium text-slate-300 max-w-32 truncate">{project.name}</span>
            </div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 animate-fade-in">
        <Outlet />
      </main>
    </div>
  )
}
