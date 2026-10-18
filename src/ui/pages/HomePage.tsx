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
    try {
      sessionStorage.removeItem('cms_event_description')
      sessionStorage.removeItem('cms_expected_participants')
      localStorage.removeItem('cms_event_description')
      localStorage.removeItem('cms_expected_participants')
      sessionStorage.setItem('cms_session_active', 'true')
    } catch {}
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
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* ── Navigation ─────────────────────────────────────── */}
      <header className="h-[76px] border-b border-line bg-bg sticky top-0 z-50">
        <div className="max-w-[1120px] mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-[36px] h-[36px] rounded-[8px] bg-accent flex items-center justify-center shrink-0">
              <span className="text-white font-semibold text-[12px] leading-none">CMS</span>
            </div>
            <div className="flex flex-col leading-[1.15]">
              <span className="font-semibold text-[17px] text-ink">Content</span>
              <span className="font-semibold text-[17px] text-ink">Studio</span>
            </div>
            <span className="text-[14px] text-muted font-normal ml-6 hidden sm:inline">by ACM NIT Surat</span>
          </div>

          <div className="flex items-center gap-8">
            <a href="https://github.com" className="text-[15px] font-medium text-text hover:text-ink transition-colors">
              GitHub
            </a>
            <button
              id="home-start-btn"
              onClick={handleStart}
              className="h-[44px] px-[22px] rounded-[8px] bg-ink hover:bg-ink-hover text-white text-[15px] font-medium inline-flex items-center justify-center transition-colors"
            >
              Start Designing →
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="pt-16 pb-20">
        <div className="max-w-[1120px] mx-auto px-8 text-left">
          {/* Badge */}
          <div className="h-[36px] px-4 rounded-full border border-line-strong inline-flex items-center gap-2.5">
            <span className="w-[7px] h-[7px] rounded-full bg-accent shrink-0" />
            <span className="text-[14px] text-text font-normal">ACM NIT Surat — Content & Marketing Studio</span>
          </div>

          {/* Heading */}
          <h1 className="font-heading font-normal text-[52px] sm:text-[76px] lg:text-[104px] text-ink leading-[1] tracking-[-0.02em] max-w-[980px] mt-[36px]">
            Design print-ready <span className="italic text-accent">ID</span><br className="hidden sm:inline" />
            <span className="italic text-accent">cards</span> in minutes
          </h1>

          {/* Subcopy & CTAs */}
          <div className="mt-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <p className="text-[18px] sm:text-[20px] leading-[1.6] text-text max-w-[560px]">
              Type your event description. Get 3 design drafts with role-color-coded cards for participants, organizers, and mentors. Export PDF at print quality—no Photoshop needed.
            </p>

            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <button
                id="hero-cta-btn"
                onClick={handleStart}
                className="h-[48px] px-6 rounded-[8px] bg-accent hover:bg-accent-hover text-white text-[15px] font-medium inline-flex items-center justify-center transition-colors"
              >
                Start for free →
              </button>
              <button
                onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                className="h-[48px] px-6 rounded-[8px] border border-line-strong bg-transparent hover:bg-hover-surface text-ink text-[15px] font-medium inline-flex items-center justify-center transition-colors"
              >
                See example ↓
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live card preview ────────────────────────────────── */}
      <section id="demo" className="py-20 border-t border-line">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-[48px] font-heading font-normal text-ink mb-3 leading-tight">
              Three templates. Three roles. One command.
            </h2>
            <p className="text-text text-base sm:text-lg">
              "ID cards for our 24-hour hackathon at SVNIT with participants, organizers and mentors"
            </p>
          </div>

          {/* Template × Role grid */}
          <div className="space-y-12">
            {templates.map(tpl => (
              <div key={tpl.id} className="border border-line rounded-2xl p-6 sm:p-8 bg-hover-surface/20">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h3 className="font-heading font-normal text-ink text-2xl sm:text-3xl">{tpl.name}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {tpl.tags?.slice(0, 3).map(t => (
                      <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-hover-surface text-text border border-line">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  {DEMO_PEOPLE.map(person => {
                    const role = roleMap[person.role]
                    return (
                      <div key={person.id} className="space-y-3">
                        <div className="card-preview-wrapper rounded-xl overflow-hidden max-w-[260px] mx-auto border border-line shadow-sm hover:shadow-md transition-shadow bg-white">
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
                          <span className="text-xs text-text font-medium">{role.label}</span>
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
      <section className="py-20 border-t border-line">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-heading font-normal text-ink mb-3">
              Everything you need for event branding
            </h2>
            <p className="text-text text-base sm:text-lg">No design tools, no manual work, no compromises.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="bg-hover-surface/30 hover:bg-hover-surface/60 border border-line rounded-xl p-6 transition-all duration-200"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-heading font-normal text-2xl text-ink mb-2">{f.title}</h3>
                <p className="text-text text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-20 border-t border-line">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="border border-line rounded-2xl p-10 sm:p-14 bg-hover-surface/40 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-heading font-normal text-ink mb-4">
              Ready to design your first cards?
            </h2>
            <p className="text-text mb-8 text-base sm:text-lg max-w-xl mx-auto">
              Takes under 5 minutes from description to print-ready PDF.
            </p>
            <button
              id="bottom-cta-btn"
              onClick={handleStart}
              className="h-[48px] px-8 rounded-[8px] bg-accent hover:bg-accent-hover text-white text-[15px] font-medium inline-flex items-center justify-center transition-colors"
            >
              Get Started →
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-line py-8 px-8 text-center text-xs text-muted">
        <div className="max-w-[1120px] mx-auto">
          <p>© 2024 ACM Student Chapter, NIT Surat (SVNIT) · Content & Marketing Studio</p>
          <p className="mt-1">Built with React, TypeScript, SVG rendering, pdf-lib · Open source</p>
        </div>
      </footer>
    </div>
  )
}
