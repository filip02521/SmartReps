import { useCallback, useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { Activity } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { AccessibleChart } from '@/components/ui/AccessibleChart'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { PROGRESS_CHART_TOOLTIP_STYLE } from '@/components/progress/chart-style'
import { db } from '@/lib/db'
import {
  getBuiltinRpeTrend,
  getCustomRpeTrend,
  hasAnyRpeData,
  type RpeTrendGroup,
} from '@/lib/rpe-trend'

type TrendOption = {
  key: string
  label: string
  kind: 'builtin' | 'custom'
  program?: string
  customPlanId?: string
}

export function RpeTrendPanel() {
  const [groups, setGroups] = useState<RpeTrendGroup[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [anyData, setAnyData] = useState(true)
  const [options, setOptions] = useState<TrendOption[]>([])

  const loadTrendData = useCallback(async () => {
    setLoading(true)
    try {
      const hasData = await hasAnyRpeData()
      setAnyData(hasData)
      if (!hasData) {
        setOptions([])
        setGroups([])
        return
      }

      const opts: TrendOption[] = []

      // Builtin programs
      for (const program of ['pushups', 'pullups', 'squats'] as const) {
        const builtinGroups = await getBuiltinRpeTrend(program)
        for (const g of builtinGroups) {
          opts.push({ key: g.key, label: g.label, kind: 'builtin', program })
        }
      }

      // Custom plans
      const customPlans = await db.customPlans.toArray()
      const exercises = await db.exercises.toArray()
      const exerciseMap = new Map(exercises.map((e) => [e.id, e]))
      for (const plan of customPlans) {
        const customGroups = await getCustomRpeTrend(plan.id, exerciseMap)
        for (const g of customGroups) {
          opts.push({
            key: `${plan.id}:${g.key}`,
            label: `${plan.name} — ${g.label}`,
            kind: 'custom',
            customPlanId: plan.id,
          })
        }
      }

      setOptions(opts)
      setSelectedKey((prev) => prev ?? opts[0]?.key ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTrendData()
  }, [loadTrendData])

  const loadSelectedGroup = useCallback(
    async (key: string, currentOptions: TrendOption[]) => {
      const opt = currentOptions.find((o) => o.key === key)
      if (!opt) return
      setLoading(true)
      try {
        if (opt.kind === 'builtin' && opt.program) {
          const builtinGroups = await getBuiltinRpeTrend(opt.program)
          setGroups(builtinGroups.filter((g) => g.key === key))
        } else if (opt.kind === 'custom' && opt.customPlanId) {
          const exercises = await db.exercises.toArray()
          const exerciseMap = new Map(exercises.map((e) => [e.id, e]))
          const customGroups = await getCustomRpeTrend(opt.customPlanId, exerciseMap)
          const exerciseKey = key.split(':').slice(1).join(':')
          setGroups(customGroups.filter((g) => g.key === exerciseKey))
        }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!selectedKey) {
      setGroups([])
      return
    }
    void loadSelectedGroup(selectedKey, options)
  }, [selectedKey, options, loadSelectedGroup])

  const chartData = useMemo(() => {
    if (groups.length === 0) return []
    return groups[0]!.points.map((p) => ({
      date: p.date,
      rpe: p.avgRpe ?? 0,
      rir: p.avgRir ?? 0,
      sets: p.setCount,
    }))
  }, [groups])

  const hasEnoughData = chartData.length >= 2

  // Empty state: no RPE/RIR data anywhere
  if (!loading && !anyData) {
    return (
      <ProgressSection first={false} icon={Activity} title={pl.rpeTrendTitle}>
        <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-6 text-center">
          <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">{pl.rpeTrendNoData}</p>
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-muted)]">{pl.rpeTrendNoDataHint}</p>
        </div>
      </ProgressSection>
    )
  }

  return (
    <ProgressSection first={false} icon={Activity} title={pl.rpeTrendTitle}>
      <p className="mb-3 sr-text-body-sm text-[var(--sr-text-muted)]">{pl.rpeTrendSubtitle}</p>

      {/* Exercise selector */}
      {options.length > 0 && (
        <div className="mb-4">
          <label htmlFor="rpe-trend-select" className="sr-only">
            {pl.rpeTrendSelectExercise}
          </label>
          <select
            id="rpe-trend-select"
            value={selectedKey ?? ''}
            onChange={(e) => setSelectedKey(e.target.value || null)}
            className="w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2 sr-text-body-sm text-[var(--sr-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sr-brand-primary)]/30"
          >
            {options.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className="h-48 animate-pulse rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)]" />
      ) : hasEnoughData ? (
        <AccessibleChart
          label={pl.rpeTrendChartAria(chartData.length)}
          data={chartData}
          columns={[
            { key: 'date', header: pl.rpeTrendDateColumn },
            { key: 'rpe', header: pl.rpeTrendRpeColumn },
            { key: 'rir', header: pl.rpeTrendRirColumn },
            { key: 'sets', header: pl.rpeTrendSetsColumn },
          ]}
        >
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -10 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--sr-border-subtle)' }}
              />
              <YAxis
                domain={[1, 10]}
                ticks={[1, 3, 5, 7, 9]}
                tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
                labelStyle={{ color: 'var(--sr-text-primary)', fontWeight: 600 }}
              />
              {/* Sweet spot reference line at RPE 7-8 */}
              <ReferenceLine y={7} stroke="var(--sr-success)" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={9} stroke="var(--sr-warning)" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Line
                type="monotone"
                dataKey="rpe"
                stroke="var(--sr-brand-primary)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--sr-brand-primary)' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </AccessibleChart>
      ) : (
        <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-6 text-center">
          <p className="sr-text-body-sm text-[var(--sr-text-muted)]">{pl.rpeTrendNoDataForExercise}</p>
        </div>
      )}
    </ProgressSection>
  )
}
