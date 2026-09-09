import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { Program } from '@/data/plans/types'

const accentVar: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent)',
  pullups: 'var(--sr-pullups-accent)',
  squats: 'var(--sr-squats-accent)',
}

export function ProgramAccentCard({
  program,
  className,
  children,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  program: Program
  children: ReactNode
}) {
  const accent = accentVar[program]
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

export function programAccentColor(program: Program): string {
  return accentVar[program]
}
