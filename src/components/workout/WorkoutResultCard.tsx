import type { ReactNode } from 'react'
import { CheckCircle2, XCircle, Trophy, Share2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { pl } from '@/i18n/pl'
import type { PersonalRecord } from '@/lib/pr-detector'
import type { LocalAiInsight } from '@/lib/db'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { Button } from '@/components/ui/Button'

function formatPrValue(value: number, unit: 'reps' | 'kg' | 's'): string {
  const unitLabel =
    unit === 'reps'
      ? pl.prCelebrationRepsUnit
      : unit === 'kg'
        ? pl.prCelebrationWeightUnit
        : pl.prCelebrationDurationUnit
  return `${value} ${unitLabel}`
}

function prRecordLabel(record: PersonalRecord): string {
  switch (record.kind) {
    case 'bestSession':
      return pl.prCelebrationBestSession
    case 'bestMaxSet':
      return pl.prCelebrationBestMaxSet
    case 'maxReps':
      return pl.prCelebrationMaxReps(record.exerciseName ?? '')
    case 'maxWeight':
      return pl.prCelebrationMaxWeight(record.exerciseName ?? '')
    case 'maxDuration':
      return pl.prCelebrationMaxDuration(record.exerciseName ?? '')
  }
}

type WorkoutResultCardProps = {
  failed: boolean
  title: string
  subtitle: string
  prRecords?: PersonalRecord[]
  coachInsight?: LocalAiInsight | null
  onDismissInsight?: () => void
  primaryLabel: string
  onPrimaryAction: () => void
  shareLabel?: string
  onShare?: () => void
  shareDisabled?: boolean
  className?: string
  /** Optional extra zone between AI and CTA (e.g. achievements, cycle complete). */
  children?: ReactNode
}

export function WorkoutResultCard({
  failed,
  title,
  subtitle,
  prRecords = [],
  coachInsight = null,
  onDismissInsight,
  primaryLabel,
  onPrimaryAction,
  shareLabel,
  onShare,
  shareDisabled = false,
  className,
  children,
}: WorkoutResultCardProps) {
  const hasPr = prRecords.length > 0
  const hasInsight = !!coachInsight
  const hasExtra = !!children

  // Determine which dividers to show — only between visible zones
  const showDividerAfterStatus = hasPr || hasInsight || hasExtra
  const showDividerAfterPr = hasPr && (hasInsight || hasExtra)
  const showDividerAfterInsight = hasInsight && hasExtra

  const visiblePrs = prRecords.slice(0, 3)
  const extraPrs = prRecords.length - visiblePrs.length

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--sr-radius-lg)] border bg-[var(--sr-bg-elevated)]',
        'shadow-[var(--sr-shadow-card)]',
        failed ? 'border-[var(--sr-error)]/25' : 'border-[var(--sr-success)]/25',
        className,
      )}
    >
      {/* Strefa STATUS */}
      <div
        className={cn(
          'flex items-center gap-3 px-5 py-4',
          failed ? 'bg-[var(--sr-error-muted)]' : 'bg-[var(--sr-success-muted)]',
        )}
      >
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
            failed
              ? 'bg-[var(--sr-error)]/15 text-[var(--sr-error)]'
              : 'bg-[var(--sr-success)]/15 text-[var(--sr-success)]',
          )}
          aria-hidden
        >
          {failed ? <XCircle size={24} strokeWidth={2.25} /> : <CheckCircle2 size={24} strokeWidth={2.25} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--sr-text-primary)]">{title}</p>
          <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">{subtitle}</p>
        </div>
      </div>

      {/* Separator */}
      {showDividerAfterStatus && <Divider />}

      {/* Strefa PR */}
      {hasPr && (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Trophy size={20} className="shrink-0 text-[var(--sr-brand-primary)]" strokeWidth={2.25} aria-hidden />
            <p className="sr-text-h3 text-[var(--sr-text-primary)]">{pl.prCelebrationTitle}</p>
          </div>
          <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.prCelebrationSubtitle}</p>

          <ul className="mt-3 space-y-2">
            {visiblePrs.map((record) => (
              <li
                key={record.key}
                className="flex items-center justify-between gap-2 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
                    {prRecordLabel(record)}
                  </p>
                  <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                    {pl.prCelebrationPrevious(
                      record.previousValue != null ? formatPrValue(record.previousValue, record.unit) : '—',
                    )}
                  </p>
                </div>
                <p className="shrink-0 sr-text-h3 text-[var(--sr-brand-primary)]">
                  {formatPrValue(record.value, record.unit)}
                </p>
              </li>
            ))}
          </ul>

          {extraPrs > 0 && (
            <p className="mt-2 sr-text-body-sm text-[var(--sr-text-muted)]">{pl.prCelebrationMore(extraPrs)}</p>
          )}
        </div>
      )}

      {/* Separator */}
      {showDividerAfterPr && <Divider />}

      {/* Strefa AI */}
      {hasInsight && coachInsight && (
        <div className="px-5 py-4">
          <div className="flex gap-2.5">
            <AiCoachMark size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight text-[var(--sr-text-primary)]">
                {coachInsight.title}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--sr-text-secondary)]">
                {coachInsight.body}
              </p>
            </div>
            {onDismissInsight && (
              <button
                type="button"
                aria-label={pl.coachPostWorkoutDismiss}
                onClick={onDismissInsight}
                className={cn(
                  FOCUS_RING,
                  'shrink-0 rounded-[var(--sr-radius-sm)] p-1 text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)]',
                )}
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Separator */}
      {showDividerAfterInsight && <Divider />}

      {/* Extra zone (achievements, cycle complete, etc.) */}
      {hasExtra && <div className="px-5 py-4">{children}</div>}

      {/* Separator before CTA */}
      {(showDividerAfterStatus || hasExtra) && <Divider />}

      {/* Strefa CTA */}
      <div className="flex flex-col gap-2 px-5 py-4">
        <Button size="touch" fullWidth onClick={onPrimaryAction}>
          {primaryLabel}
        </Button>
        {onShare && shareLabel && !failed && (
          <Button
            variant="secondary"
            size="touch"
            fullWidth
            disabled={shareDisabled}
            onClick={onShare}
          >
            <span className="flex items-center justify-center gap-2">
              <Share2 size={16} />
              {shareLabel}
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-[var(--sr-border-subtle)]" aria-hidden />
}
