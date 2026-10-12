import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import { CardPreview } from '../components/CardPreview'
import { getDefaultBrandKit } from '../../brandKits/loader'
import { listTemplates } from '../../templates/registry'
import { DEFAULT_ROLES } from '../../core/schema/Role'
import { makeEmptyEventContext } from '../../core/schema/EventContext'

const DEMO_EVENT = {
  ...makeEmptyEventContext(),
  name:     { value: 'InCursion 2024', status: 'provided' as const },
  venue:    { value: 'SVNIT, Surat',   status: 'provided' as const },
  dateStart:{ value: '18 October 2024', status: 'provided' as const },
  tagline:  { value: '24-Hour Hackathon', status: 'provided' as const },
  organizer:{ value: 'ACM NIT Surat', status: 'provided' as const },
  website:  { value: undefined, status: 'missing' as const },
  dateEnd:  { value: undefined, status: 'missing' as const },
  duration: { value: '24-hour', status: 'provided' as const },
  contact:  { value: undefined, status: 'missing' as const },
}

const DEMO_PEOPLE = [
  { id: 'P001', name: 'Aarav Sharma',    role: 'participant', team: 'Team Alpha',  email: '', photoUrl: '', extra: {} },
  { id: 'O001', name: 'Priya Mehta',     role: 'organizer',   team: 'Core Team',   email: '', photoUrl: '', extra: {} },
  { id: 'M001', name: 'Dr. Rahul Patel', role: 'mentor',      team: 'Industry',    email: '', photoUrl: '', extra: {} },
]

const FEATURES = [
  { icon: '🤖', title: 'AI-Powered',      desc: 'Describe your event in plain English. Our AI extracts all the details and asks only for what\'s missing.' },
  { icon: '🎨', title: 'Vector Sharp',    desc: 'All designs are SVG-based, print-sharp at 600 DPI. No rasterized text or blurry logos.' },
  { icon: '📋', title: 'Template-Driven', desc: 'Three distinct design styles. Role-aware color coding so every card looks purposeful.' },
  { icon: '📊', title: 'Batch Ready',     desc: 'Import 200+ participants from CSV, get a unique QR-coded card for each person instantly.' },
  { icon: '✅', title: 'Auto-Validated',  desc: 'Every card passes contrast, overflow, logo integrity, and safe-margin checks before export.' },
  { icon: '📤', title: 'Print-Ready',     desc: 'Export PDF (vector), PNG (up to 600 DPI), or SVG with bleed and crop marks included.' },
]

export function HomePage() {
  const navigate   = useNavigate()
  const newProject = useProjectStore(s => s.newProject)
  const brandKit   = getDefaultBrandKit()
  const templates  = listTemplates('idCard')

  function handleStart() {
    newProject()
    navigate('/studio/describe')
  }

  const participantRole = DEFAULT_ROLES[0]
  const organizerRole   = DEFAULT_ROLES[1]
  const mentorRole      = DEFAULT_ROLES[2]
  const roleMap: Record<string, typeof DEFAULT_ROLES[0]> = {
    participant: participantRole,
    organizer:   organizerRole,
    mentor:      mentorRole,
  }

  return (
    <div className="min-h-screen">
      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-surface-900/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-acm-600 flex items-center justify-center shadow-glow-acm">
              <span className="text-white font-bold text-xs">CMS</span>
            </div>
            <div>
              <span className="font-display font-semibold text-sm text-white">Content Studio</span>
              <span className="hidden sm:inline text-slate-500 text-xs ml-2">by ACM NIT Surat</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com" className="btn-ghost text-xs hidden md:flex">GitHub</a>
            <button id="home-start-btn" onClick={handleStart} className="btn-primary text-sm">
              Start Designing →
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-acm-600/10 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-acm-600/20 border border-acm-500/30 text-acm-300 text-sm font-medium mb-6 animate-fade-in">
            <img src="/assets/acm-logo.svg" alt="ACM" className="w-5 h-5" />
            ACM NIT Surat — Content & Marketing Studio
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-6 leading-tight animate-slide-up">
            Design print-ready<br />
            <span className="text-gradient">ID cards</span> in minutes
          </h1>

          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up">
            Type your event description. Get 3 design drafts with role-color-coded cards for participants, organizers, and mentors. Export PDF at print quality—no Photoshop needed.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <button
              id="hero-cta-btn"
              onClick={handleStart}
              className="btn-primary text-base px-8 py-4 shadow-glow-acm"
            >
              Start for free →
            </button>
            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-secondary text-base px-8 py-4"
            >
              See example ↓
            </button>
          </div>
        </div>
      </section>

      {/* ── Live card preview ────────────────────────────────── */}
      <section id="demo" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-white mb-3">
              Three templates. Three roles. One command.
            </h2>
            <p className="text-slate-400">
              "ID cards for our 24-hour hackathon at SVNIT with participants, organizers and mentors"
            </p>
          </div>

          {/* Template × Role grid */}
          <div className="space-y-10">
            {templates.map(tpl => (
              <div key={tpl.id}>
                <div className="flex items-center gap-3 mb-5">
                  <h3 className="font-display font-semibold text-white text-xl">{tpl.name}</h3>
                  <div className="flex gap-1">
                    {tpl.tags?.slice(0, 3).map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  {DEMO_PEOPLE.map(person => {
                    const role = roleMap[person.role]
                    return (
                      <div key={person.id} className="space-y-2">
                        <div className="card-preview-wrapper rounded-xl overflow-hidden max-w-[260px] mx-auto shadow-2xl">
                          <CardPreview
                            template={tpl}
                            role={role}
                            person={person}
                            event={DEMO_EVENT}
                            brandKit={brandKit}
                          />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: role.palette.primary }}
                          />
                          <span className="text-xs text-slate-400">{role.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-display font-bold text-white mb-3">Everything you need for event branding</h2>
            <p className="text-slate-400">No design tools, no manual work, no compromises.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="glass p-6 group hover:border-acm-500/30 transition-all duration-300">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-display font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto">
          <div className="glass p-12 glow-blue">
            <h2 className="text-3xl font-display font-bold text-white mb-4">
              Ready to design your first cards?
            </h2>
            <p className="text-slate-400 mb-8">
              Takes under 5 minutes from description to print-ready PDF.
            </p>
            <button
              id="bottom-cta-btn"
              onClick={handleStart}
              className="btn-primary text-base px-10 py-4 shadow-glow-acm"
            >
              Get Started →
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-8 px-6 text-center text-xs text-slate-600">
        <p>© 2024 ACM Student Chapter, NIT Surat (SVNIT) · Content & Marketing Studio</p>
        <p className="mt-1">Built with React, TypeScript, SVG rendering, pdf-lib · Open source</p>
      </footer>
    </div>
  )
}
