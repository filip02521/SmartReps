import { useMemo } from 'react'
import { TrendingUp, Minus, Database } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { Card } from '@/components/ui/Card'
import { computeForecasts, type ExerciseForecast } from '@/lib/forecasting'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
import { dateBcp47 } from '@/lib/date-locale'
import { cn } from '@/lib/utils'
import type { LocalWorkoutSession } from '@/lib/db'

function metricValue(f: ExerciseForecast, v: number, weightUnit: 'kg' | 'lb'): string {
  // kgToDisplay returns raw kg — round for display (e1rm values are floats).
  if (f.metric === 'e1rm')
    return `${Math.round(kgToDisplay(v, weightUnit) * 10) / 10} ${weightUnitLabel(weightUnit)}`
  if (f.metric === 'duration') return pl.forecastDurationValue(Math.round(v))
  return pl.forecastRepsValue(Math.round(v))
}

function ForecastRow({ f, weightUnit }: { f: ExerciseForecast; weightUnit: 'kg' | 'lb' }) {
  const pct = Math.min(100, Math.round((f.currentBest / f.milestone) * 100))
  const weeklyGain = f.slopePerDay * 7

  return (
    <li className="border-t border-[var(--sr-border-subtle)] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--sr-text-primary)]">{f.name}</p>
          <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">
            {pl.forecastProgress(metricValue(f, f.currentBest, weightUnit), metricValue(f, f.milestone, weightUnit))}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {f.status === 'ok' && f.predictedDate ? (
            <>
              <p className="flex items-center justify-end gap-1 text-sm font-bold tabular-nums text-[var(--sr-brand-primary)]">
                <TrendingUp size={14} aria-hidden />
                {new Date(`${f.predictedDate}T12:00:00`).toLocaleDateString(dateBcp47(), {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
              <p className="mt-0.5 text-[11px] tabular-nums text-[var(--sr-text-muted)]">
                {pl.forecastWeeklyGain(metricValue(f, weeklyGain, weightUnit))}
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
      <p className="mb-3 text-xs text-[var(--sr-text-muted)]">{pl.forecastHint}</p>
      <ul>
        {forecasts.map((f) => (
          <ForecastRow key={f.key} f={f} weightUnit={weightUnit} />
        ))}
      </ul>
    </Card>
  )
}
