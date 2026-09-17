import { useMemo } from 'react'
import { TrendingUp, Minus, Database } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { Card } from '@/components/ui/Card'
import { computeForecasts, type ExerciseForecast } from '@/lib/forecasting'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
import { formatRestTime } from '@/lib/utils'
import { dateBcp47 } from '@/lib/date-locale'
import { cn } from '@/lib/utils'
import type { LocalWorkoutSession } from '@/lib/db'

function fmtNum(v: number, maxFrac = 0): string {
  return v.toLocaleString(dateBcp47(), { maximumFractionDigits: maxFrac })
}

/** `displayV` is already in display units (lb for e1rm+lb, else raw). */
function metricValue(
  f: ExerciseForecast,
  displayV: number,
  weightUnit: 'kg' | 'lb',
  maxFrac = 0,
): string {
  if (f.metric === 'e1rm')
    return `${fmtNum(displayV, Math.max(1, maxFrac))} ${weightUnitLabel(weightUnit)}`
  if (f.metric === 'duration')
    return displayV >= 60
      ? formatRestTime(Math.round(displayV))
      : pl.forecastDurationValue(fmtNum(displayV, maxFrac))
  return pl.forecastRepsValue(fmtNum(displayV, maxFrac))
}

function ForecastRow({ f, weightUnit }: { f: ExerciseForecast; weightUnit: 'kg' | 'lb' }) {
  const toDisplay = (v: number) => (f.metric === 'e1rm' ? kgToDisplay(v, weightUnit) : v)
  const dispBest = toDisplay(f.currentBest)
  // Goal in display units — for e1rm recompute so lb users see round goals
  // ("185 lb"), not an awkward "187.4 lb" converted from an 85 kg milestone.
  const dispGoal = f.metric === 'e1rm' ? Math.floor(dispBest / 5) * 5 + 5 : toDisplay(f.milestone)
  const pct = Math.min(100, Math.round((dispBest / dispGoal) * 100))
  // 1 decimal so small-but-positive slopes don't render as "+0/wk" next to
  // a predicted date.
  const dispGain = toDisplay(f.slopePerDay * 7)

  return (
    <li className="border-t border-[var(--sr-border-subtle)] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--sr-text-primary)]">{f.name}</p>
          <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">
            {pl.forecastProgress(metricValue(f, dispBest, weightUnit), metricValue(f, dispGoal, weightUnit))}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {f.status === 'ok' && f.predictedDate ? (
            <>
              <p className="flex items-center justify-end gap-1 text-sm font-bold tabular-nums text-[var(--sr-brand-primary)]">
                <TrendingUp size={14} aria-hidden />
                {/* ≈ marks low/medium confidence — the date is a linear-fit
                    estimate, not a promise. */}
                {f.confidence !== 'high' && '≈ '}
                {new Date(`${f.predictedDate}T12:00:00`).toLocaleDateString(dateBcp47(), {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
              <p className="mt-0.5 text-[11px] tabular-nums text-[var(--sr-text-muted)]">
                {pl.forecastWeeklyGain(metricValue(f, dispGain, weightUnit, 1))}
              </p>
            </>
          ) : f.status === 'flat' ? (
            <p className="flex items-center justify-end gap-1 text-xs text-[var(--sr-text-muted)]">
              <Minus size={13} aria-hidden />
              {pl.forecastFlat}
            </p>
          ) : (
            <p className="flex items-center justify-end gap-1 text-xs text-[var(--sr-text-muted)]">
              <Database size={13} aria-hidden />
              {pl.forecastInsufficient}
            </p>
          )}
        </div>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sr-bg-elevated)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={pl.forecastProgressAria(f.name, pct)}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            f.status === 'ok' ? 'bg-[var(--sr-brand-primary)]' : 'bg-[var(--sr-text-muted)]',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  )
}

export function ForecastSection({
  sessions,
  exerciseMap,
  weightUnit = 'kg',
}: {
  sessions: LocalWorkoutSession[]
  exerciseMap: Map<string, { name: string }>
  weightUnit?: 'kg' | 'lb'
}) {
  const forecasts = useMemo(() => computeForecasts(sessions, exerciseMap), [sessions, exerciseMap])

  if (forecasts.length === 0) {
    return (
      <Card className="p-4">
        <p className="sr-text-body-sm text-[var(--sr-text-muted)]">{pl.forecastEmpty}</p>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <ul>
        {forecasts.map((f) => (
          <ForecastRow key={f.key} f={f} weightUnit={weightUnit} />
        ))}
      </ul>
    </Card>
  )
}
