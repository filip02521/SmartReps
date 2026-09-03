import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { Program } from '@/data/plans/types'

const accentVar: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent)',
  pullups: 'var(--sr-pullups-accent)',
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
      className={cn('relative overflow-hidden border-l-4 transition-colors hover:border-l-[var(--sr-border-strong)]', className)}
      style={
        {
          ...style,
          borderLeftColor: accent,
          backgroundImage: `linear-gradient(
            135deg,
            color-mix(in srgb, ${accent} 12%, var(--sr-bg-elevated)) 0%,
            var(--sr-bg-elevated) 42%
          )`,
        } as CSSProperties
      }
    >
      {children}
    </Card>
  )
}

export function programAccentColor(program: Program): string {
  return accentVar[program]
}
