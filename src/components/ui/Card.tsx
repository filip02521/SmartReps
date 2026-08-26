import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'sr-card rounded-[var(--sr-radius-lg)] bg-[var(--sr-bg-elevated)] p-5 shadow-[var(--sr-shadow-card)]',
        className,
      )}
      {...props}
    />
  )
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}) {
  const colors = {
    default: 'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary-hover)]',
    success: 'bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
    warning: 'bg-[rgba(251,191,36,0.15)] text-[var(--sr-warning)]',
    error: 'bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
    info: 'bg-[rgba(96,165,250,0.15)] text-[var(--sr-info)]',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--sr-radius-full)] px-2.5 py-0.5 text-xs font-medium',
        colors[variant],
        className,
      )}
      {...props}
    />
  )
}
