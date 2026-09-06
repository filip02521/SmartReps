import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { format } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'
import { Plus, Trash2, Scale, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { Sheet } from '@/components/ui/Sheet'
import { SkeletonCard } from '@/components/ux/Feedback'
import { AccessibleChart } from '@/components/ui/AccessibleChart'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { pl } from '@/i18n/pl'
import { showToast } from '@/stores/toast-store'
import {
  listBodyWeightEntries,
  addBodyWeightEntry,
  deleteBodyWeightEntry,
} from '@/lib/body-weight'
import type { BodyWeightEntry } from '@/lib/db'
import {
  getBodyWeightPerformanceCorrelation,
  formatCorrelationLabel,
  type BodyWeightCorrelation,
} from '@/lib/body-weight-correlation'
import { useAppStore } from '@/stores/app-store'
import { kgToDisplay, displayToKg, weightUnitLabel } from '@/lib/weight-units'

export function BodyWeightSection() {
  const [entries, setEntries] = useState<BodyWeightEntry[]>([])
  const [correlation, setCorrelation] = useState<BodyWeightCorrelation | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const weightUnit = useAppStore((s) => s.settings.weightUnit)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      const data = await listBodyWeightEntries()
      setEntries(data)
      const corr = await getBodyWeightPerformanceCorrelation()
      setCorrelation(corr)
    } catch {
      setEntries([])
      setCorrelation(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    const value = Number(weightInput)
    if (!value || value <= 0) {
      showToast(pl.bodyWeightInvalid, 'error')
      return
    }
    const kg = displayToKg(value, weightUnit)
    if (kg < 20 || kg > 300) {
      showToast(pl.bodyWeightOutOfRange, 'error')
      return
    }
    await addBodyWeightEntry(kg, noteInput)
    setShowAdd(false)
    setWeightInput('')
    setNoteInput('')
    await load()
    showToast(pl.bodyWeightSaved, 'success')
  }

  async function handleDelete(id: string) {
    await deleteBodyWeightEntry(id)
    await load()
  }

  const chartData = entries
    .slice(0, 30)
    .reverse()
    .map((e) => ({
      date: format(new Date(e.measuredAt), 'MM.dd'),
      weight: kgToDisplay(e.weightKg, weightUnit),
      label: format(new Date(e.measuredAt), 'd MMM yyyy', { locale: dateFnsLocale() }),
    }))

  const latest = entries[0]
  const previous = entries[1]
  const delta =
    latest && previous
      ? Math.round((kgToDisplay(latest.weightKg, weightUnit) - kgToDisplay(previous.weightKg, weightUnit)) * 10) / 10
      : null

  if (loading) {
    return (
      <ProgressSection icon={Scale} title={pl.bodyWeightTitle}>
        <SkeletonCard className="min-h-[6rem]" />
      </ProgressSection>
    )
  }

  return (
    <ProgressSection
      icon={Scale}
      title={pl.bodyWeightTitle}
      hint={
        entries.length === 1
          ? pl.bodyWeightAddMoreForTrend
          : undefined
      }
    >
      {/* Latest value + add button */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {latest ? (
            <p className="text-2xl font-bold tabular-nums text-[var(--sr-text-primary)]">
              {kgToDisplay(latest.weightKg, weightUnit)}
              <span className="ml-1 text-sm font-medium text-[var(--sr-text-muted)]">
                {weightUnitLabel(weightUnit)}
              </span>
              {delta != null && delta !== 0 && (
                <span className="ml-2 text-sm font-medium text-[var(--sr-text-muted)]">
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              )}
            </p>
          ) : (
            <p className="sr-text-body-sm text-[var(--sr-text-muted)]">{pl.bodyWeightEmpty}</p>
          )}
        </div>
        <Button size="sm" className="min-h-11 shrink-0" onClick={() => setShowAdd(true)}>
          <Plus size={16} aria-hidden />
          {pl.bodyWeightAdd}
        </Button>
      </div>

      {/* Chart */}
      {chartData.length >= 2 && (
        <AccessibleChart
          label={pl.bodyWeightChartAria(chartData.length, kgToDisplay(latest?.weightKg ?? 0, weightUnit), weightUnitLabel(weightUnit))}
          data={chartData.map((d) => ({ date: d.label, weight: d.weight }))}
          columns={[
            { key: 'date', header: pl.dateColumn },
            { key: 'weight', header: weightUnitLabel(weightUnit) },
          ]}
          className="mt-4 h-36 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-2 pl-3"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{
                  background: 'var(--sr-bg-surface)',
                  border: '1px solid var(--sr-border-subtle)',
                  borderRadius: 'var(--sr-radius-sm)',
                  fontSize: '12px',
                  boxShadow: 'var(--sr-shadow-card)',
                }}
                labelStyle={{ color: 'var(--sr-text-secondary)' }}
                formatter={(v) => [`${v} ${weightUnitLabel(weightUnit)}`, pl.bodyWeightTitle]}
              />
              <Line type="monotone" dataKey="weight" stroke="var(--sr-brand-primary)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--sr-brand-primary)' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </AccessibleChart>
      )}

      {/* Entry list */}
      {entries.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--sr-border-subtle)]">
          {entries.slice(0, 5).map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5 sr-text-body-sm">
              <span className="flex-1 font-medium tabular-nums text-[var(--sr-text-primary)]">
                {kgToDisplay(e.weightKg, weightUnit)}
                <span className="ml-1 text-xs font-normal text-[var(--sr-text-muted)]">
                  {weightUnitLabel(weightUnit)}
                </span>
              </span>
              <span className="text-xs text-[var(--sr-text-muted)]">
                {format(new Date(e.measuredAt), 'd MMM yyyy', { locale: dateFnsLocale() })}
              </span>
              {e.note && (
                <span className="max-w-24 truncate text-xs text-[var(--sr-text-secondary)]">
                  {e.note}
                </span>
              )}
              <button
                type="button"
                className={`flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)] text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-error)] active:scale-95 ${FOCUS_RING}`}
                onClick={() => void handleDelete(e.id)}
                aria-label={pl.bodyWeightDelete}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title={pl.bodyWeightAddTitle}>
        <div className="flex flex-col gap-4 pb-4">
          <div>
            <label htmlFor="bw-value" className="block text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.bodyWeightLabel} ({weightUnitLabel(weightUnit)})
            </label>
            <input
              id="bw-value"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder={weightUnit === 'kg' ? '75.0' : '165.0'}
              className={`mt-2 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-base text-[var(--sr-text-primary)] ${FOCUS_RING}`}
            />
          </div>
          <div>
            <label htmlFor="bw-note" className="block text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.sessionNoteLabel}
            </label>
            <input
              id="bw-note"
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value.slice(0, 100))}
              placeholder={pl.bodyWeightNotePlaceholder}
              className={`mt-2 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-base text-[var(--sr-text-primary)] ${FOCUS_RING}`}
            />
          </div>
          <Button size="touch" fullWidth onClick={() => void handleAdd()}>
            {pl.bodyWeightSave}
          </Button>
        </div>
      </Sheet>

      {/* Body weight × performance correlation */}
      {correlation && !correlation.insufficientData && correlation.points.length >= 3 && (
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <TrendingUp
              size={16}
              className="text-[var(--sr-text-muted)]"
              strokeWidth={2.25}
              aria-hidden
            />
            <p className="sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
              {pl.bodyWeightCorrelationTitle}
            </p>
          </div>
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.bodyWeightCorrelationHint}
          </p>
          <p className="mt-2 sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {formatCorrelationLabel(correlation, pl)}
          </p>
          <AccessibleChart
            label={pl.bodyWeightCorrelationChartAria(correlation.points.length)}
            data={correlation.points.map((p) => ({
              date: format(new Date(p.date), 'd MMM', { locale: dateFnsLocale() }),
              weight: p.weight,
              performance: p.performance,
            }))}
            columns={[
              { key: 'date', header: pl.dateColumn },
              { key: 'weight', header: pl.bodyWeightAxisLabel },
              { key: 'performance', header: pl.performanceAxisLabel },
            ]}
            className="mt-3 h-48 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={correlation.points.map((p) => ({
                  dateLabel: format(new Date(p.date), 'd MMM', { locale: dateFnsLocale() }),
                  weight: p.weight,
                  performance: p.performance,
                }))}
              >
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }}
                  stroke="var(--sr-border-subtle)"
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="weight"
                  orientation="left"
                  tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }}
                  stroke="var(--sr-border-subtle)"
                  width={36}
                />
                <YAxis
                  yAxisId="performance"
                  orientation="right"
                  tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }}
                  stroke="var(--sr-border-subtle)"
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--sr-bg-elevated)',
                    border: '1px solid var(--sr-border-subtle)',
                    borderRadius: 'var(--sr-radius-md)',
                    fontSize: '12px',
                  }}
                  formatter={(value, name) => {
                    if (name === 'weight') return [`${value} ${weightUnitLabel(weightUnit)}`, pl.bodyWeightAxisLabel]
                    return [value, pl.performanceAxisLabel]
                  }}
                />
                <ReferenceLine y={0} stroke="transparent" />
                <Line
                  yAxisId="weight"
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--sr-brand-primary)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--sr-brand-primary)' }}
                  name="weight"
                />
                <Line
                  yAxisId="performance"
                  type="monotone"
                  dataKey="performance"
                  stroke="var(--sr-pushups-accent)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--sr-pushups-accent)' }}
                  name="performance"
                />
              </LineChart>
            </ResponsiveContainer>
          </AccessibleChart>
        </div>
      )}
    </ProgressSection>
  )
}
