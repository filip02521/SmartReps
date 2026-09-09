import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { pl } from '@/i18n/pl'
import { PROGRESS_CHART_TOOLTIP_STYLE } from '@/components/progress/chart-style'

type MaxPerDayPoint = { day: number | string; maxActual: number }

export function MaxPerDayChart({ data }: { data: MaxPerDayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis
          dataKey="day"
          tickFormatter={(d) => pl.chartDayShort(Number(d))}
          tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
          stroke="var(--sr-border-subtle)"
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
          stroke="var(--sr-border-subtle)"
          width={28}
        />
        <Tooltip
          contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
          formatter={(value) => [value ?? 0, pl.repsUnit]}
          labelFormatter={(label) => String(label)}
          cursor={{ fill: 'var(--sr-brand-primary-muted)' }}
        />
        <Bar dataKey="maxActual" fill="var(--sr-brand-primary)" radius={4} />
      </BarChart>
    </ResponsiveContainer>
  )
}
