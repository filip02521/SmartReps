import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AiCoachMark } from './AiCoachMark'
import { pl } from '@/i18n/pl'

/**
 * SmartReps AI Coach header — introduces the coach persona
 * with its brand mark, name, and optional status line.
 *
 * Used at the top of AI-powered sections (analysis, plan generator)
 * to create a consistent "talking to your coach" mental model.
 */
export function AiCoachHeader({
  title = pl.aiCoachName,
  subtitle,
  status,
  pulse = false,
  size = 'md' as const,
  className,
  children,
}: {
  title?: string
  subtitle?: string
  /** Status line — e.g. "Analyzing your workouts…" when processing. */
  status?: string
  pulse?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] p-3',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(
          135deg,
          color-mix(in srgb, var(--sr-brand-primary) 8%, var(--sr-bg-elevated)) 0%,
          var(--sr-bg-elevated) 60%
        )`,
      }}
    >
      <AiCoachMark size={size} pulse={pulse} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-bold leading-tight text-[var(--sr-text-primary)]">
          <span className="sr-gradient-text">{title}</span>
        </p>
        {subtitle && (
          <p className="mt-0.5 text-xs leading-snug text-[var(--sr-text-secondary)]">
            {subtitle}
          </p>
        )}
        {status && (
          <p
            className={cn(
              'mt-0.5 text-xs font-medium',
              pulse ? 'text-[var(--sr-brand-primary)]' : 'text-[var(--sr-text-muted)]',
            )}
          >
            {status}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * A coach "message" bubble — left-aligned, brand-tinted,
 * visually distinct from user/system content.
 */
export function AiCoachMessage({
  children,
  className,
  tone = 'default',
}: {
  children: ReactNode
  className?: string
  tone?: 'default' | 'insight' | 'warning' | 'success'
}) {
  const toneStyles: Record<string, string> = {
    default: 'border-[var(--sr-border-subtle)]',
    insight: 'border-[var(--sr-brand-primary)]/30',
    warning: 'border-[var(--sr-warning)]/40',
    success: 'border-[var(--sr-success)]/40',
  }
  const toneBg: Record<string, string> = {
    default: 'var(--sr-bg-elevated)',
    insight: 'color-mix(in srgb, var(--sr-brand-primary-muted) 60%, var(--sr-bg-elevated))',
    warning: 'color-mix(in srgb, var(--sr-warning-muted) 50%, var(--sr-bg-elevated))',
    success: 'color-mix(in srgb, var(--sr-success-muted) 50%, var(--sr-bg-elevated))',
  }
  return (
    <div
      className={cn(
        'sr-coach-msg-in flex gap-2.5 rounded-[var(--sr-radius-md)] border p-3',
        toneStyles[tone],
        className,
      )}
      style={{ background: toneBg[tone] }}
    >
      <AiCoachMark size="sm" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
        {children}
      </div>
    </div>
  )
}
