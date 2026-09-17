import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { Program } from '@/data/plans/types'

const accentVar: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent)',
  pullups: 'var(--sr-pullups-accent)',
  squats: 'var(--sr-squats-accent)',
}

/** Shared home-card chrome: thin accent edge + faint accent gradient.
 *  One shell for builtin program cards and custom plan cards so both read
 *  as the same visual object on the dashboard. Chrome stays quiet — the
 *  accent carries program identity (edge, icon badge, current rail day). */
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
      className={cn('border-l-[3px] p-4', className)}
      style={
        {
          ...style,
          borderLeftColor: accent,
          backgroundImage: `linear-gradient(
            135deg,
            color-mix(in srgb, ${accent} 7%, var(--sr-bg-elevated)) 0%,
            var(--sr-bg-elevated) 45%
          )`,
        } as CSSProperties
      }
    >
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
