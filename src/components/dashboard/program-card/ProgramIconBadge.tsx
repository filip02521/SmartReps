import type { ReactNode } from 'react'
import { ProgramIcon } from '@/components/ui/ProgramIcon'

/** Home-card icon badge — 44px rounded tile with the accent tint and ring.
 *  Shared by builtin program cards (ProgramIcon) and custom plan cards. */
export function AccentIconBadge({
  accent,
  children,
}: {
  accent: string
  children: ReactNode
}) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-lg)] ring-1"
      style={{
        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
        color: accent,
        // @ts-expect-error — CSS custom property
        '--tw-ring-color': `color-mix(in srgb, ${accent} 25%, transparent)`,
      }}
      aria-hidden
    >
      {children}
    </div>
  )
}

/** Program icon badge — larger, with gradient ring. */
export function ProgramIconBadge({ program }: { program: 'pushups' | 'pullups' | 'squats' }) {
  const accentVar =
    program === 'pushups'
      ? 'var(--sr-pushups-accent)'
      : program === 'pullups'
        ? 'var(--sr-pullups-accent)'
        : 'var(--sr-squats-accent)'
  return (
    <AccentIconBadge accent={accentVar}>
      <ProgramIcon program={program} size={26} />
    </AccentIconBadge>
  )
}
