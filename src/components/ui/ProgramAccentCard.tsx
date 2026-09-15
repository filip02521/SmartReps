import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { Program } from '@/data/plans/types'

const accentVar: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent)',
  pullups: 'var(--sr-pullups-accent)',
  squats: 'var(--sr-squats-accent)',
}

/** Shared home-card chrome: accent left border, gradient tint, corner glow.
 *  One shell for builtin program cards and custom plan cards so both read
 *  as the same visual object on the dashboard. */
export function AccentCard({
  accent,
  className,
  children,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  accent: string
  children: ReactNode
}) {
  return (
    <Card
      {...props}
      className={cn(
        'relative overflow-hidden border-l-4 transition-all hover:border-l-[var(--sr-border-strong)] hover:shadow-[var(--sr-shadow-elevated)]',
        className,
      )}
      style={
        {
          ...style,
          borderLeftColor: accent,
          backgroundImage: `linear-gradient(
            135deg,
            color-mix(in srgb, ${accent} 10%, var(--sr-bg-elevated)) 0%,
            var(--sr-bg-elevated) 50%
          )`,
        } as CSSProperties
      }
    >
      {/* Subtle accent glow in top-right corner */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
        aria-hidden
      />
      {children}
    </Card>
  )
}

export function ProgramAccentCard({
  program,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  program: Program
  children: ReactNode
}) {
  return <AccentCard accent={accentVar[program]} {...props} />
}

export function programAccentColor(program: Program): string {
  return accentVar[program]
}
