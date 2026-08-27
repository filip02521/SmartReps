import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageSection({
  title,
  hint,
  children,
  className,
  titleAs: TitleTag = 'h2',
}: {
  title: string
  hint?: ReactNode
  children: ReactNode
  className?: string
  titleAs?: 'h2' | 'h3'
}) {
  return (
    <section className={cn('mt-6', className)}>
      <TitleTag className={TitleTag === 'h2' ? 'sr-text-h2' : 'sr-text-h3'}>{title}</TitleTag>
      {hint != null && (
        <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{hint}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}
