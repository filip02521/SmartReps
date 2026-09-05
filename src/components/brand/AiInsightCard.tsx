import { AiCoachMark } from './AiCoachMark'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { pl } from '@/i18n/pl'
import type { LocalAiInsight } from '@/lib/db'

const TONE_STYLES: Record<LocalAiInsight['tone'], string> = {
  insight: 'border-[var(--sr-brand-primary)]/30',
  warning: 'border-[var(--sr-warning)]/40',
  success: 'border-[var(--sr-success)]/40',
}

const TONE_BG: Record<LocalAiInsight['tone'], string> = {
  insight: 'color-mix(in srgb, var(--sr-brand-primary-muted) 60%, var(--sr-bg-elevated))',
  warning: 'color-mix(in srgb, var(--sr-warning-muted) 50%, var(--sr-bg-elevated))',
  success: 'color-mix(in srgb, var(--sr-success-muted) 50%, var(--sr-bg-elevated))',
}

export function AiInsightCard({
  insight,
  onDismiss,
  className,
}: {
  insight: LocalAiInsight
  onDismiss?: () => void
  className?: string
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        'sr-coach-msg-in flex gap-2.5 rounded-[var(--sr-radius-md)] border p-3',
        TONE_STYLES[insight.tone],
        className,
      )}
      style={{ background: TONE_BG[insight.tone] }}
    >
      <AiCoachMark size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-[var(--sr-text-primary)]">
          {insight.title}
        </p>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--sr-text-secondary)]">
          {insight.body}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label={pl.coachPostWorkoutDismiss}
          onClick={onDismiss}
          className="shrink-0 rounded-[var(--sr-radius-sm)] p-1 text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  )
}
