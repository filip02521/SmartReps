import { pl } from '@/i18n/pl'
import { useId } from 'react'
import { Trophy, Flame, Target, CheckCircle2, TrendingUp, Check, Clock, Lightbulb } from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'

export type OnboardingIllustrationStep = 'welcome' | 'interest' | 'programs' | 'next'

export function OnboardingIllustration({ step }: { step: OnboardingIllustrationStep }) {
  if (step === 'interest' || step === 'programs') {
    return null
  }

  if (step === 'welcome') {
    return <PhoneMockup />
  }

  // 'next' — animated celebration with confetti
  return <CelebrationIllustration />
}

/* ─── Phone mockup — real React UI, not SVG ─── */

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[200px]">
      {/* Glow behind phone */}
      <div
        className="absolute inset-0 -z-10 rounded-[28px] opacity-50 blur-2xl"
        style={{ background: 'var(--sr-brand-primary-muted)' }}
        aria-hidden
      />
      {/* Phone frame */}
      <div className="overflow-hidden rounded-[24px] border-2 border-[var(--sr-border-strong)] bg-[var(--sr-bg-elevated)] shadow-xl">
        {/* Notch */}
        <div className="flex justify-center bg-[var(--sr-bg-surface)] py-1.5">
          <div className="h-1 w-12 rounded-full bg-[var(--sr-border-strong)]" />
        </div>
        {/* Screen content */}
        <div className="flex flex-col items-center px-4 pb-4 pt-3">
          {/* Program + day label */}
          <p className="text-[10px] font-semibold text-[var(--sr-text-secondary)]">
            {pl.pushupsProgram} · {pl.onboardingIllustDay}
          </p>
          {/* Big rep target */}
          <p className="mt-2 text-5xl font-extrabold leading-none sr-gradient-text">
            12
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[var(--sr-text-muted)]">
            {pl.onboardingIllustReps}
          </p>
          {/* Set checklist */}
          <div className="mt-4 flex w-full flex-col gap-2">
            {/* Done set */}
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--sr-success)]">
                <Check size={12} className="text-[var(--sr-bg-elevated)]" strokeWidth={3} />
              </span>
              <div className="h-2 flex-1 rounded-full bg-[var(--sr-bg-surface)]" />
            </div>
            {/* Active set */}
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--sr-brand-primary)]" />
              <div className="h-2 flex-1 rounded-full bg-[var(--sr-brand-primary)] opacity-50" />
            </div>
            {/* Pending set */}
            <div className="flex items-center gap-2 opacity-60">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--sr-border-strong)]" />
              <div className="h-2 flex-1 rounded-full bg-[var(--sr-bg-surface)]" />
            </div>
          </div>
          {/* Rest timer pill */}
          <div className="mt-3 flex items-center gap-1.5 rounded-full bg-[var(--sr-bg-surface)] px-3 py-1">
            <Clock size={10} className="text-[var(--sr-brand-secondary)]" />
            <span className="text-[10px] font-semibold text-[var(--sr-text-muted)]">0:45</span>
          </div>
          {/* Done CTA */}
          <div className="mt-4 w-full rounded-full bg-gradient-to-r from-[var(--sr-brand-primary)] to-[var(--sr-brand-secondary)] py-2.5 text-center">
            <span className="text-xs font-bold text-[var(--sr-text-inverse)]">
              {pl.onboardingIllustDone}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Celebration illustration — scale-in + confetti ─── */

function CelebrationIllustration() {
  const uid = useId().replace(/:/g, '')
  const gradId = `sr-celebration-grad-${uid}`

  // Confetti particles — 8 pieces flying outward
  const particles = [
    { x: 60, y: 60, dx: -35, dy: -30, delay: 0, color: 'var(--sr-brand-primary)' },
    { x: 60, y: 60, dx: 35, dy: -30, delay: 100, color: 'var(--sr-brand-secondary)' },
    { x: 60, y: 60, dx: -40, dy: 0, delay: 200, color: 'var(--sr-success)' },
    { x: 60, y: 60, dx: 40, dy: 0, delay: 150, color: 'var(--sr-brand-primary)' },
    { x: 60, y: 60, dx: -30, dy: 30, delay: 80, color: 'var(--sr-brand-secondary)' },
    { x: 60, y: 60, dx: 30, dy: 30, delay: 120, color: 'var(--sr-success)' },
    { x: 60, y: 60, dx: 0, dy: -40, delay: 50, color: 'var(--sr-brand-primary)' },
    { x: 60, y: 60, dx: 0, dy: 40, delay: 180, color: 'var(--sr-brand-secondary)' },
  ]

  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-32 w-full max-w-[140px]" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--sr-brand-primary)" />
          <stop offset="1" stopColor="var(--sr-brand-secondary)" />
        </linearGradient>
      </defs>
      {/* Soft glow */}
      <circle cx="60" cy="60" r="50" fill="var(--sr-brand-primary-muted)" opacity="0.4" />
      {/* Confetti particles */}
      {particles.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="2.5"
          fill={p.color}
          className="sr-confetti"
          style={{ ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, animationDelay: `${p.delay}ms` }}
        />
      ))}
      {/* Outer ring — scale in */}
      <circle
        cx="60" cy="60" r="42" fill="none" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round"
        className="sr-celebration-ring"
      />
      {/* Inner filled circle — preserves opacity via separate animation */}
      <circle
        cx="60" cy="60" r="34" fill={`url(#${gradId})`} opacity="0.12"
        className="sr-celebration-ring-inner"
      />
      {/* Checkmark — scale in with delay */}
      <path
        d="M44 61 L55 72 L78 48"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sr-celebration-check"
      />
    </svg>
  )
}

/* ─── Carousel slide illustrations ─── */

/** Slide 1 — phone mockup with workout UI */
export function SlideCyclesIllustration() {
  return <PhoneMockup />
}

/** Slide 2 — AI Coach weekly report preview card (mirrors real AiCoachHeader + AiCoachMessage UI) */
export function SlideAiIllustration() {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 shadow-xl">
      {/* Coach header — gradient background like real AiCoachHeader */}
      <div
        className="mb-3 flex items-center gap-2.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] p-2.5"
        style={{
          backgroundImage: `linear-gradient(135deg, color-mix(in srgb, var(--sr-brand-primary) 8%, var(--sr-bg-elevated)) 0%, var(--sr-bg-elevated) 60%)`,
        }}
      >
        <AiCoachMark size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-bold leading-tight">
            <span className="sr-gradient-text">{pl.onboardingAiPreviewCoachName}</span>
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--sr-text-secondary)]">
            {pl.onboardingAiPreviewWeek}
          </p>
        </div>
      </div>

      {/* Stats row — 3 compact metrics */}
      <div className="mb-2.5 grid grid-cols-3 gap-1.5">
        <StatTile icon={Check} value="4" label={pl.onboardingAiPreviewStatSessions} tone="neutral" />
        <StatTile icon={TrendingUp} value="+12%" label={pl.onboardingAiPreviewStatVolume} tone="success" />
        <StatTile icon={Trophy} value="45" label={pl.onboardingAiPreviewStatPr} tone="brand" />
      </div>

      {/* Summary message — insight tone (brand-tinted bubble) */}
      <div
        className="mb-2 flex gap-2 rounded-[var(--sr-radius-sm)] border p-2"
        style={{
          borderColor: 'color-mix(in srgb, var(--sr-brand-primary) 30%, transparent)',
          background: 'color-mix(in srgb, var(--sr-brand-primary-muted) 60%, var(--sr-bg-elevated))',
        }}
      >
        <AiCoachMark size="sm" />
        <p className="text-[11px] leading-snug text-[var(--sr-text-secondary)]">
          {pl.onboardingAiPreviewSummary}
        </p>
      </div>

      {/* Strength — success tone bubble */}
      <div
        className="mb-2 flex gap-2 rounded-[var(--sr-radius-sm)] border p-2"
        style={{
          borderColor: 'color-mix(in srgb, var(--sr-success) 40%, transparent)',
          background: 'color-mix(in srgb, var(--sr-success-muted) 50%, var(--sr-bg-elevated))',
        }}
      >
        <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--sr-success)]" strokeWidth={3} />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--sr-success)]">
            {pl.onboardingAiPreviewStrengthLabel}
          </p>
          <p className="text-[11px] leading-snug text-[var(--sr-text-secondary)]">
            {pl.onboardingAiPreviewStrength}
          </p>
        </div>
      </div>

      {/* Suggestion — insight tone bubble with Lightbulb */}
      <div
        className="flex gap-2 rounded-[var(--sr-radius-sm)] border p-2"
        style={{
          borderColor: 'color-mix(in srgb, var(--sr-brand-primary) 30%, transparent)',
          background: 'color-mix(in srgb, var(--sr-brand-primary-muted) 50%, var(--sr-bg-elevated))',
        }}
      >
        <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-[var(--sr-brand-primary)]" />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--sr-brand-primary)]">
            {pl.onboardingAiPreviewSuggestionLabel}
          </p>
          <p className="text-[11px] leading-snug text-[var(--sr-text-secondary)]">
            {pl.onboardingAiPreviewSuggestion}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Compact stat tile for the AI preview metrics row */
function StatTile({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Check
  value: string
  label: string
  tone: 'neutral' | 'success' | 'brand'
}) {
  const color =
    tone === 'success' ? 'var(--sr-success)' : tone === 'brand' ? 'var(--sr-brand-secondary)' : 'var(--sr-text-primary)'
  return (
    <div className="flex flex-col items-center rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)] px-1 py-1.5">
      <Icon className="mb-0.5 h-3 w-3" style={{ color }} aria-hidden />
      <span className="text-xs font-bold leading-none" style={{ color }}>{value}</span>
      <span className="mt-0.5 text-[9px] leading-tight text-[var(--sr-text-muted)]">{label}</span>
    </div>
  )
}

/** Slide 3 — animated progress chart + premium badge grid */
export function SlideProgressIllustration({ isActive }: { isActive: boolean }) {
  const uid = useId().replace(/:/g, '')
  const chartGrad = `sr-chart-grad-${uid}`
  const animKey = isActive ? 'active' : 'inactive'

  // Chart data — upward trend over 8 weeks
  const points = [10, 15, 18, 22, 28, 35, 42, 50]
  const maxVal = 50
  const w = 200
  const h = 80
  const pad = 8
  const stepX = (w - pad * 2) / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = pad + i * stepX
    const y = h - pad - (v / maxVal) * (h - pad * 2)
    return { x, y }
  })
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${h - pad} L ${coords[0].x} ${h - pad} Z`

  const badges = [
    { icon: Target, label: pl.onboardingBadgeFirst100, gradient: 'from-orange-500 to-red-500', glow: 'rgba(249,115,22,0.3)' },
    { icon: Flame, label: pl.onboardingBadgeStreak, gradient: 'from-amber-500 to-orange-600', glow: 'rgba(245,158,11,0.3)' },
    { icon: Trophy, label: pl.onboardingBadgePr, gradient: 'from-cyan-400 to-blue-500', glow: 'rgba(34,211,238,0.3)' },
    { icon: CheckCircle2, label: pl.onboardingBadgeCycle, gradient: 'from-emerald-400 to-green-600', glow: 'rgba(52,211,153,0.3)' },
  ]

  return (
    <div className="mx-auto w-full max-w-[260px]">
      {/* Animated chart */}
      <div className="mb-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--sr-text-secondary)]">{pl.onboardingChartReps}</p>
          <span className="text-[10px] text-[var(--sr-text-muted)]">{pl.onboardingChartLabel}</span>
        </div>
        <svg key={animKey} viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" aria-hidden>
          <defs>
            <linearGradient id={chartGrad} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--sr-brand-primary)" />
              <stop offset="1" stopColor="var(--sr-brand-secondary)" />
            </linearGradient>
            <linearGradient id={`${chartGrad}-fill`} x1="0" y1="0" x2="0" y2={h} gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--sr-brand-primary)" stopOpacity="0.2" />
              <stop offset="1" stopColor="var(--sr-brand-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${chartGrad}-fill)`} />
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${chartGrad})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sr-chart-line-draw"
          />
          <circle
            cx={coords[coords.length - 1].x}
            cy={coords[coords.length - 1].y}
            r="3"
            fill="var(--sr-brand-secondary)"
            className="sr-chart-dot-pop"
          />
        </svg>
      </div>
      {/* Premium badge grid */}
      <div key={animKey} className="grid grid-cols-2 gap-2">
        {badges.map((b, i) => (
          <div
            key={b.label}
            className="flex flex-col items-center gap-1.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-2 py-2.5 sr-badge-premium"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${b.gradient}`}
              style={{ boxShadow: `0 0 12px ${b.glow}` }}
            >
              <b.icon className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-center text-[10px] font-semibold leading-tight text-[var(--sr-text-secondary)]">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
