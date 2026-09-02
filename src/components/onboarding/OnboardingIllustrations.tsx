import { pl } from '@/i18n/pl'

export type OnboardingIllustrationStep = 'welcome' | 'interest' | 'programs' | 'next'

export function OnboardingIllustration({ step }: { step: OnboardingIllustrationStep }) {
  if (step === 'welcome') {
    return (
      <svg viewBox="0 0 200 120" className="mx-auto h-28 w-full max-w-[200px]" aria-hidden>
        <circle
          cx="100"
          cy="60"
          r="48"
          fill="var(--sr-brand-primary-muted)"
          stroke="var(--sr-brand-primary)"
          strokeWidth="2"
          strokeDasharray="10 6"
        />
        <text
          x="100"
          y="68"
          textAnchor="middle"
          fill="var(--sr-brand-primary)"
          fontSize="28"
          fontWeight="700"
        >
          R
        </text>
        {[0, 1, 2, 3, 4].map((i) => (
          <circle
            key={i}
            cx={100 + Math.cos((i * 72 * Math.PI) / 180) * 36}
            cy={60 + Math.sin((i * 72 * Math.PI) / 180) * 36}
            r="4"
            fill="var(--sr-brand-secondary)"
          />
        ))}
      </svg>
    )
  }

  if (step === 'interest') {
    return (
      <svg viewBox="0 0 200 100" className="mx-auto h-24 w-full max-w-[200px]" aria-hidden>
        <rect
          x="16"
          y="18"
          width="78"
          height="64"
          rx="12"
          fill="var(--sr-brand-primary-muted)"
          stroke="var(--sr-brand-primary)"
          strokeWidth="2"
        />
        <rect
          x="106"
          y="18"
          width="78"
          height="64"
          rx="12"
          fill="var(--sr-bg-elevated)"
          stroke="var(--sr-border-strong)"
          strokeWidth="2"
        />
        <text
          x="55"
          y="55"
          textAnchor="middle"
          fill="var(--sr-brand-primary)"
          fontSize="11"
          fontWeight="600"
        >
          {pl.onboardingIllustStrong}
        </text>
        <text
          x="145"
          y="55"
          textAnchor="middle"
          fill="var(--sr-text-secondary)"
          fontSize="11"
          fontWeight="600"
        >
          {pl.onboardingIllustCustom}
        </text>
      </svg>
    )
  }

  if (step === 'programs') {
    return (
      <svg viewBox="0 0 200 100" className="mx-auto h-24 w-full max-w-[200px]" aria-hidden>
        <rect
          x="20"
          y="20"
          width="70"
          height="60"
          rx="12"
          fill="var(--sr-pushups-accent)"
          opacity="0.2"
          stroke="var(--sr-pushups-accent)"
          strokeWidth="2"
        />
        <rect
          x="110"
          y="20"
          width="70"
          height="60"
          rx="12"
          fill="var(--sr-pullups-accent)"
          opacity="0.2"
          stroke="var(--sr-pullups-accent)"
          strokeWidth="2"
        />
        <text
          x="55"
          y="58"
          textAnchor="middle"
          fill="var(--sr-pushups-accent)"
          fontSize="12"
          fontWeight="600"
        >
          {pl.pushupsProgram}
        </text>
        <text
          x="145"
          y="58"
          textAnchor="middle"
          fill="var(--sr-pullups-accent)"
          fontSize="11"
          fontWeight="600"
        >
          {pl.pullupsProgram}
        </text>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 200 100" className="mx-auto h-24 w-full max-w-[200px]" aria-hidden>
      <path
        d="M30 70 L70 30 L110 55 L170 25"
        fill="none"
        stroke="var(--sr-brand-primary)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {[30, 70, 110, 170].map((x, i) => (
        <circle
          key={i}
          cx={x}
          cy={i === 0 ? 70 : i === 1 ? 30 : i === 2 ? 55 : 25}
          r="6"
          fill="var(--sr-brand-secondary)"
        />
      ))}
      <text x="100" y="90" textAnchor="middle" fill="var(--sr-text-muted)" fontSize="10">
        {pl.onboardingIllustNext}
      </text>
    </svg>
  )
}
