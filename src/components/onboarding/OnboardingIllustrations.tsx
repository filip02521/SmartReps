import { pl } from '@/i18n/pl'
import { useId } from 'react'
import { Sparkles, Trophy, Flame, Target, CheckCircle2 } from 'lucide-react'

export type OnboardingIllustrationStep = 'welcome' | 'interest' | 'programs' | 'next'

export function OnboardingIllustration({ step }: { step: OnboardingIllustrationStep }) {
  const uid = useId().replace(/:/g, '')
  const gradId = `sr-onboard-grad-${uid}`

  if (step === 'interest' || step === 'programs') {
    // These steps no longer use illustrations — cards below carry the visuals.
    return null
  }

  if (step === 'welcome') {
    return (
      <svg viewBox="0 0 150 200" className="mx-auto h-40 w-full max-w-[130px]" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="11" y1="8" x2="139" y2="192" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sr-brand-primary)" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" />
          </linearGradient>
          <linearGradient id={`${gradId}-btn`} x1="40" y1="154" x2="110" y2="176" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sr-brand-primary)" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" />
          </linearGradient>
          <linearGradient id={`${gradId}-screen`} x1="11" y1="20" x2="139" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sr-brand-secondary)" stopOpacity="0.06" />
            <stop offset="1" stopColor="var(--sr-brand-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Soft glow behind phone */}
        <ellipse cx="75" cy="102" rx="64" ry="80" fill="var(--sr-brand-primary-muted)" opacity="0.5" />
        {/* Phone frame */}
        <rect x="11" y="8" width="128" height="184" rx="22" fill="var(--sr-bg-elevated)" stroke="var(--sr-border-strong)" strokeWidth="2" />
        {/* Screen subtle gradient sheen */}
        <rect x="13" y="22" width="124" height="170" rx="18" fill={`url(#${gradId}-screen)`} />
        {/* Notch */}
        <rect x="58" y="14" width="34" height="6" rx="3" fill="var(--sr-bg-surface)" />
        {/* Screen top label — program + day */}
        <text x="75" y="40" textAnchor="middle" fill="var(--sr-text-secondary)" fontSize="8" fontWeight="600" fontFamily="var(--sr-font)">
          {pl.pushupsProgram} · {pl.onboardingIllustDay}
        </text>
        {/* Big rep target — display number, brand gradient */}
        <text x="75" y="78" textAnchor="middle" fill={`url(#${gradId})`} fontSize="40" fontWeight="800" fontFamily="var(--sr-font)">
          12
        </text>
        <text x="75" y="92" textAnchor="middle" fill="var(--sr-text-muted)" fontSize="7" fontWeight="600" fontFamily="var(--sr-font)">
          {pl.onboardingIllustReps}
        </text>
        {/* Set checklist — 3 rows */}
        {/* Done set */}
        <circle cx="28" cy="112" r="4" fill="var(--sr-success)" />
        <path d="M26 112 l1.5 1.5 l3 -3" stroke="var(--sr-bg-elevated)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="38" y="109" width="84" height="6" rx="3" fill="var(--sr-bg-surface)" />
        {/* Active set — brand accent */}
        <circle cx="28" cy="128" r="4" fill="none" stroke={`url(#${gradId})`} strokeWidth="2" />
        <rect x="38" y="125" width="84" height="6" rx="3" fill={`url(#${gradId})`} opacity="0.5" />
        {/* Pending set — muted */}
        <circle cx="28" cy="144" r="3.5" fill="none" stroke="var(--sr-border-strong)" strokeWidth="1.5" />
        <rect x="38" y="141" width="84" height="6" rx="3" fill="var(--sr-bg-surface)" opacity="0.6" />
        {/* Rest timer pill — subtle, between checklist and CTA */}
        <rect x="44" y="154" width="62" height="10" rx="5" fill="var(--sr-bg-surface)" />
        <circle cx="50" cy="159" r="2" fill="var(--sr-brand-secondary)" />
        <text x="75" y="162" textAnchor="middle" fill="var(--sr-text-muted)" fontSize="6" fontWeight="600" fontFamily="var(--sr-font)">
          0:45
        </text>
        {/* "Zrobione" CTA pill — brand gradient */}
        <rect x="32" y="170" width="86" height="20" rx="10" fill={`url(#${gradId}-btn)`} />
        <text x="75" y="183" textAnchor="middle" fill="var(--sr-text-inverse)" fontSize="9" fontWeight="700" fontFamily="var(--sr-font)">
          {pl.onboardingIllustDone}
        </text>
      </svg>
    )
  }

  // 'next' — checkmark circle "all set"
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-28 w-full max-w-[120px]" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--sr-brand-primary)" />
          <stop offset="1" stopColor="var(--sr-brand-secondary)" />
        </linearGradient>
      </defs>
      {/* Soft glow */}
      <circle cx="60" cy="60" r="50" fill="var(--sr-brand-primary-muted)" opacity="0.4" />
      {/* Outer ring — gradient */}
      <circle cx="60" cy="60" r="42" fill="none" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" />
      {/* Inner filled circle */}
      <circle cx="60" cy="60" r="34" fill={`url(#${gradId})`} opacity="0.12" />
      {/* Checkmark — gradient stroke */}
      <path
        d="M44 61 L55 72 L78 48"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ─── Carousel slide illustrations ─── */

/** Slide 1 — phone mockup with workout UI (reuses welcome illustration) */
export function SlideCyclesIllustration() {
  return <OnboardingIllustration step="welcome" />
}

/** Slide 2 — AI Coach weekly report preview card */
export function SlideAiIllustration() {
  return (
    <div className="mx-auto w-full max-w-[260px] rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4 shadow-sm">
      {/* Header — coach name + week */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sr-brand-primary-muted)]">
          <Sparkles className="h-4 w-4 text-[var(--sr-brand-primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--sr-text-primary)]">
            {pl.onboardingAiPreviewCoachName}
          </p>
          <p className="text-xs text-[var(--sr-text-muted)]">{pl.onboardingAiPreviewWeek}</p>
        </div>
      </div>
      {/* Stats row */}
      <div className="mb-3 flex gap-2">
        <div className="flex-1 rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)] px-2.5 py-2">
          <p className="text-[10px] font-medium text-[var(--sr-text-muted)]">{pl.onboardingChartReps}</p>
          <p className="text-sm font-bold text-[var(--sr-text-primary)]">312</p>
        </div>
        <div className="flex-1 rounded-[var(--sr-radius-sm)] bg-[var(--sr-success-muted)] px-2.5 py-2">
          <p className="text-[10px] font-medium text-[var(--sr-text-muted)]">Vol</p>
          <p className="text-sm font-bold text-[var(--sr-success)]">+12%</p>
        </div>
      </div>
      {/* PR line */}
      <div className="mb-2 flex items-center gap-1.5">
        <Trophy className="h-3.5 w-3.5 shrink-0 text-[var(--sr-brand-secondary)]" />
        <p className="text-xs font-medium text-[var(--sr-text-secondary)]">{pl.onboardingAiPreviewPr}</p>
      </div>
      {/* Suggestion */}
      <div className="flex items-start gap-1.5 rounded-[var(--sr-radius-sm)] bg-[var(--sr-brand-primary-muted)] px-2.5 py-2">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[var(--sr-brand-primary)]" />
        <p className="text-xs text-[var(--sr-text-secondary)]">{pl.onboardingAiPreviewSuggestion}</p>
      </div>
    </div>
  )
}

/** Slide 3 — animated progress chart + badge grid */
export function SlideProgressIllustration() {
  const uid = useId().replace(/:/g, '')
  const chartGrad = `sr-chart-grad-${uid}`

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
    { icon: Target, label: pl.onboardingBadgeFirst100 },
    { icon: Flame, label: pl.onboardingBadgeStreak },
    { icon: Trophy, label: pl.onboardingBadgePr },
    { icon: CheckCircle2, label: pl.onboardingBadgeCycle },
  ]

  return (
    <div className="mx-auto w-full max-w-[260px]">
      {/* Animated chart */}
      <div className="mb-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--sr-text-secondary)]">{pl.onboardingChartReps}</p>
          <span className="text-[10px] text-[var(--sr-text-muted)]">{pl.onboardingChartLabel}</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" aria-hidden>
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
          {/* Area fill */}
          <path d={areaPath} fill={`url(#${chartGrad}-fill)`} />
          {/* Line — animated draw */}
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${chartGrad})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sr-chart-line-draw"
          />
          {/* End dot */}
          <circle
            cx={coords[coords.length - 1].x}
            cy={coords[coords.length - 1].y}
            r="3"
            fill="var(--sr-brand-secondary)"
            className="sr-chart-dot-pop"
          />
        </svg>
      </div>
      {/* Badge grid */}
      <div className="grid grid-cols-2 gap-2">
        {badges.map((b) => (
          <div
            key={b.label}
            className="flex items-center gap-2 rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-2.5 py-2 sr-badge-shimmer"
          >
            <b.icon className="h-4 w-4 shrink-0 text-[var(--sr-brand-primary)]" />
            <span className="truncate text-xs font-medium text-[var(--sr-text-secondary)]">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
