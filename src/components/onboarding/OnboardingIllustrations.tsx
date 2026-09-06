import { pl } from '@/i18n/pl'
import { useId } from 'react'

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
