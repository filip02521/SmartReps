import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'
import { StatusPill } from '@/components/ui/StatusPill'

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

/**
 * Badge — status pill used across cards. Thin wrapper over the shared
 * StatusPill system so all label chips share one chrome.
 */
export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}) {
  const toneMap = {
    default: 'brand',
    success: 'success',
    warning: 'warning',
    error: 'error',
    info: 'info',
  } as const
  const tone = toneMap[variant]
  return (
    <StatusPill
      tone={tone}
      size="md"
      className={cn(
        'py-0.5 font-medium',
        variant === 'default' && 'text-[var(--sr-brand-primary-hover)]',
        className,
      )}
      {...props}
    />
  )
}
