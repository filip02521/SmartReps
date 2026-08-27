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
  return (
    <Card
      {...props}
      className={cn('border-l-4', className)}
      style={{ ...style, borderLeftColor: accentVar[program] } as CSSProperties}
    >
      {children}
    </Card>
  )
}

export function programAccentColor(program: Program): string {
  return accentVar[program]
}
