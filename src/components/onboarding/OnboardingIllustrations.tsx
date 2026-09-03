import { pl } from '@/i18n/pl'
import { useId } from 'react'

export type OnboardingIllustrationStep = 'welcome' | 'interest' | 'programs' | 'next'

export function OnboardingIllustration({ step }: { step: OnboardingIllustrationStep }) {
  const uid = useId().replace(/:/g, '')
  const gradId = `sr-onboard-grad-${uid}`

  if (step === 'welcome') {
    return (
      <svg viewBox="0 0 200 120" className="mx-auto h-28 w-full max-w-[200px]" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="200" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sr-brand-primary)" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" />
          </linearGradient>
        </defs>
        {/* Glow circle */}
        <circle cx="100" cy="60" r="52" fill="var(--sr-brand-primary-muted)" />
        {/* Main ring */}
        <circle
          cx="100"
          cy="60"
          r="44"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Accent arc */}
        <path
          d="M 100 16 A 44 44 0 0 1 144 60"
          fill="none"
          stroke="var(--sr-brand-secondary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        {/* Letter R */}
        <text
          x="100"
          y="70"
          textAnchor="middle"
          fill={`url(#${gradId})`}
          fontSize="28"
          fontWeight="800"
          fontFamily="var(--sr-font)"
        >
          R
        </text>
        {/* Orbiting dots */}
        {[0, 1, 2, 3, 4].map((i) => {
          const angle = (i * 72 * Math.PI) / 180
          return (
            <circle
              key={i}
              cx={100 + Math.cos(angle) * 34}
              cy={60 + Math.sin(angle) * 34}
              r="3.5"
              fill="var(--sr-brand-secondary)"
              opacity={0.7}
            />
          )
        })}
      </svg>
    )
  }

  if (step === 'interest') {
    return (
      <svg viewBox="0 0 200 100" className="mx-auto h-24 w-full max-w-[200px]" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="16" y1="18" x2="94" y2="82" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sr-brand-primary)" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" />
          </linearGradient>
        </defs>
        {/* Strong card — brand gradient border */}
        <rect
          x="16"
          y="18"
          width="78"
          height="64"
          rx="14"
          fill="var(--sr-brand-primary-muted)"
          stroke={`url(#${gradId})`}
          strokeWidth="2"
        />
        {/* Custom card — neutral */}
        <rect
          x="106"
          y="18"
          width="78"
          height="64"
          rx="14"
          fill="var(--sr-bg-elevated)"
          stroke="var(--sr-border-strong)"
          strokeWidth="2"
        />
        {/* Dumbbell icon in strong card */}
        <g transform="translate(38, 38)">
          <rect x="0" y="6" width="4" height="12" rx="1" fill="var(--sr-brand-primary)" />
          <rect x="30" y="6" width="4" height="12" rx="1" fill="var(--sr-brand-primary)" />
          <rect x="4" y="3" width="2" height="18" rx="1" fill="var(--sr-brand-primary)" />
          <rect x="28" y="3" width="2" height="18" rx="1" fill="var(--sr-brand-primary)" />
          <rect x="6" y="11" width="22" height="2" rx="1" fill="var(--sr-brand-primary)" />
        </g>
        {/* Custom icon — grid */}
        <g transform="translate(128, 38)" stroke="var(--sr-text-secondary)" strokeWidth="2" fill="none">
          <rect x="0" y="0" width="10" height="10" rx="2" />
          <rect x="22" y="0" width="10" height="10" rx="2" />
          <rect x="0" y="22" width="10" height="10" rx="2" />
          <rect x="22" y="22" width="10" height="10" rx="2" />
        </g>
        <text
          x="55"
          y="74"
          textAnchor="middle"
          fill="var(--sr-brand-primary)"
          fontSize="10"
          fontWeight="700"
          fontFamily="var(--sr-font)"
        >
          {pl.onboardingIllustStrong}
        </text>
        <text
          x="145"
          y="74"
          textAnchor="middle"
          fill="var(--sr-text-secondary)"
          fontSize="10"
          fontWeight="600"
          fontFamily="var(--sr-font)"
        >
          {pl.onboardingIllustCustom}
        </text>
      </svg>
    )
  }

  if (step === 'programs') {
    return (
      <svg viewBox="0 0 200 100" className="mx-auto h-24 w-full max-w-[200px]" aria-hidden>
        {/* Pushups card */}
        <rect
          x="20"
          y="20"
          width="70"
          height="60"
          rx="14"
          fill="var(--sr-pushups-accent)"
          opacity="0.15"
          stroke="var(--sr-pushups-accent)"
          strokeWidth="2"
        />
        {/* Pullups card */}
        <rect
          x="110"
          y="20"
          width="70"
          height="60"
          rx="14"
          fill="var(--sr-pullups-accent)"
          opacity="0.15"
          stroke="var(--sr-pullups-accent)"
          strokeWidth="2"
        />
        {/* Pushup icon — person doing pushup */}
        <g transform="translate(32, 38)" fill="var(--sr-pushups-accent)">
          <circle cx="6" cy="4" r="4" />
          <rect x="2" y="9" width="28" height="3" rx="1.5" />
          <rect x="0" y="12" width="4" height="6" rx="1" />
        </g>
        {/* Pullup icon — bar with person */}
        <g transform="translate(122, 36)" fill="var(--sr-pullups-accent)">
          <rect x="0" y="0" width="40" height="3" rx="1.5" />
          <circle cx="20" cy="10" r="4" />
          <rect x="18" y="14" width="4" height="12" rx="1.5" />
        </g>
        <text
          x="55"
          y="72"
          textAnchor="middle"
          fill="var(--sr-pushups-accent)"
          fontSize="11"
          fontWeight="700"
          fontFamily="var(--sr-font)"
        >
          {pl.pushupsProgram}
        </text>
        <text
          x="145"
          y="72"
          textAnchor="middle"
          fill="var(--sr-pullups-accent)"
          fontSize="10"
          fontWeight="700"
          fontFamily="var(--sr-font)"
        >
          {pl.pullupsProgram}
        </text>
      </svg>
    )
  }

  // 'next' — progress chart
  return (
    <svg viewBox="0 0 200 100" className="mx-auto h-24 w-full max-w-[200px]" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="30" y1="70" x2="170" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--sr-brand-primary)" />
          <stop offset="1" stopColor="var(--sr-brand-secondary)" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      <line x1="20" y1="80" x2="180" y2="80" stroke="var(--sr-border-subtle)" strokeWidth="1" />
      <line x1="20" y1="50" x2="180" y2="50" stroke="var(--sr-border-subtle)" strokeWidth="0.5" strokeDasharray="3 3" />
      {/* Progress line with gradient */}
      <path
        d="M30 70 L70 40 L110 50 L170 25"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Data points */}
      {[
        { x: 30, y: 70 },
        { x: 70, y: 40 },
        { x: 110, y: 50 },
        { x: 170, y: 25 },
      ].map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r="5"
          fill="var(--sr-bg-base)"
          stroke={`url(#${gradId})`}
          strokeWidth="2.5"
        />
      ))}
      {/* Up arrow at the end */}
      <path
        d="M170 25 L165 30 M170 25 L175 30"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <text x="100" y="95" textAnchor="middle" fill="var(--sr-text-muted)" fontSize="9" fontWeight="600" fontFamily="var(--sr-font)">
        {pl.onboardingIllustNext}
      </text>
    </svg>
  )
}
