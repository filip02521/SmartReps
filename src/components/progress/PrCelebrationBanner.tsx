import { useState } from 'react'
import { Trophy, X } from 'lucide-react'
import { pl } from '@/i18n/pl'
import type { PersonalRecord } from '@/lib/pr-detector'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

function formatValue(value: number, unit: 'reps' | 'kg' | 's'): string {
  const unitLabel =
    unit === 'reps'
      ? pl.prCelebrationRepsUnit
      : unit === 'kg'
        ? pl.prCelebrationWeightUnit
        : pl.prCelebrationDurationUnit
  return `${value} ${unitLabel}`
}

function recordLabel(record: PersonalRecord): string {
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

export function PrCelebrationBanner({ records }: { records: PersonalRecord[] }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || records.length === 0) return null

  const visible = records.slice(0, 3)
  const extra = records.length - visible.length

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-brand-primary)]/40 p-4',
        'bg-gradient-to-br from-[color-mix(in_srgb,var(--sr-brand-primary)_12%,var(--sr-bg-elevated))] to-[var(--sr-bg-elevated)]',
        'animate-[sr-pr-pulse_1.6s_ease-in-out_1]',
      )}
      style={{
        animation: 'srPrSlideIn 0.4s ease-out, srPrPulse 1.6s ease-in-out 1',
      }}
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={pl.prCelebrationDismiss}
        className={cn(
          FOCUS_RING,
          'absolute right-2 top-2 rounded-full p-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-text-primary)]',
        )}
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <Trophy
            size={28}
            className="text-[var(--sr-brand-primary)]"
            strokeWidth={2.25}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="sr-text-h3 text-[var(--sr-text-primary)]">
            {pl.prCelebrationTitle}
          </p>
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.prCelebrationSubtitle}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {visible.map((record) => (
          <li
            key={record.key}
            className="flex items-center justify-between gap-2 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
                {recordLabel(record)}
              </p>
              <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.prCelebrationPrevious(
                  record.previousValue != null
                    ? formatValue(record.previousValue, record.unit)
                    : '—',
                )}
              </p>
            </div>
            <p className="shrink-0 sr-text-h3 text-[var(--sr-brand-primary)]">
              {formatValue(record.value, record.unit)}
            </p>
          </li>
        ))}
      </ul>

      {extra > 0 && (
        <p className="mt-2 sr-text-body-sm text-[var(--sr-text-muted)]">
          {pl.prCelebrationMore(extra)}
        </p>
      )}

      <style>{`
        @keyframes srPrSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes srPrPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--sr-brand-primary) 30%, transparent); }
          50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--sr-brand-primary) 0%, transparent); }
        }
      `}</style>
    </div>
  )
}
