// Forecasting: "cele i prognozy" — regresja liniowa na tygodniowych maksimach
// per ćwiczenie. Builtin sessions (pushups/pullups/squats) → best reps/tydzień;
// custom sessions → e1RM (serie z ciężarem), reps albo czas — wybierana jest
// metryka z największą liczbą punktów (preferencja: e1rm > reps > duration).
//
// Założenia bezpieczeństwa:
// - minimum MIN_POINTS punktów tygodniowych i MIN_SPAN_DAYS dni historii,
// - prognoza tylko przy dodatnim nachyleniu i horyzoncie ≤ MAX_HORIZON_DAYS,
// - R² raportowane jako confidence (niska/średnia/wysoka) — UI nie obiecuje
//   dokładnej daty, tylko orientacyjny termin.

import { estimate1rm } from '@/lib/exercise-model'
import { programLabel } from '@/lib/home-summary'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'

export type ForecastMetric = 'e1rm' | 'reps' | 'duration'

export type ForecastConfidence = 'low' | 'medium' | 'high'

export type ExerciseForecast = {
  /** 'builtin:pushups' albo exerciseId z planu custom. */
  key: string
  name: string
  metric: ForecastMetric
  /** Liczba punktów tygodniowych w regresji. */
  points: number
  spanDays: number
  currentBest: number
  lastValue: number
  /** Następny "okrągły" cel powyżej rekordu. */
  milestone: number
  /** Jednostki/dzień (wewnętrznie); UI pokazuje /tydzień. */
  slopePerDay: number
  r2: number
  confidence: ForecastConfidence
  status: 'ok' | 'flat' | 'insufficient'
  /** ISO yyyy-mm-dd albo null gdy brak wiarygodnej prognozy. */
  predictedDate: string | null
}

export const FORECAST_MIN_POINTS = 4
export const FORECAST_MIN_SPAN_DAYS = 21
export const FORECAST_MAX_HORIZON_DAYS = 365
/** Last data point older than this makes any extrapolation untrustworthy. */
export const FORECAST_STALE_DAYS = 45
export const FORECAST_MAX_ROWS = 5

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

type RawPoint = { t: number; v: number }

type Series = {
  key: string
  name: string
  metric: ForecastMetric
  points: RawPoint[]
}

const BUILTIN_PROGRAMS: Program[] = ['pushups', 'pullups', 'squats']

function sessionTime(s: LocalWorkoutSession): number {
  return new Date(s.completedAt ?? s.startedAt).getTime()
}

/** Z agreguje surowe punkty dzienne do maksimów tygodniowych (7-dniowe kubełki od pierwszego punktu). */
function toWeeklyMax(points: RawPoint[]): RawPoint[] {
  if (points.length === 0) return []
  const t0 = Math.min(...points.map((p) => p.t))
  const byWeek = new Map<number, { t: number; v: number }>()
  for (const p of points) {
    const w = Math.floor((p.t - t0) / WEEK_MS)
    const cur = byWeek.get(w)
    if (!cur || p.v > cur.v) byWeek.set(w, { t: p.t, v: p.v })
  }
  return Array.from(byWeek.values()).sort((a, b) => a.t - b.t)
}

/** Najlepsza wartość serii dla zadanej metryki. Zwraca 0 gdy seria nie pasuje. */
function bestSetValue(
  set: { actual: { reps?: number; durationSec?: number; weightKg?: number | null } },
  metric: ForecastMetric,
): number {
  const { reps = 0, durationSec = 0, weightKg = 0 } = set.actual
  switch (metric) {
    case 'e1rm':
      return reps > 0 && (weightKg ?? 0) > 0 ? estimate1rm(weightKg ?? 0, reps) : 0
    case 'reps':
      // reps bez ciężaru — dla reps_weight z ciężarem metryką jest e1rm
      return reps
    case 'duration':
      return durationSec
  }
}

/**
 * Buduje serie tygodniowe per źródło: builtin programy (reps) + custom
 * exercises (najlepiej pokryta metryka). Zwraca tylko serie z ≥1 punktem.
 */
export function buildForecastSeries(
  sessions: LocalWorkoutSession[],
  exerciseMap: Map<string, { name: string }>,
): Series[] {
  const byKey = new Map<string, Series>()

  const sorted = sessions
    .filter((s) => s.status === 'completed')
    .map((s) => ({ s, t: sessionTime(s) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t)

  // Punkty surowe per custom exercise per metryka — wybór metryki na końcu.
  const customPoints = new Map<string, { name: string; byMetric: Record<ForecastMetric, RawPoint[]> }>()

  for (const { s, t } of sorted) {
    if (s.program !== 'custom' && BUILTIN_PROGRAMS.includes(s.program as Program)) {
      const key = `builtin:${s.program}`
      let best = 0
      for (const r of s.setResults ?? []) {
        if (r.actual > best) best = r.actual
      }
      if (best > 0) {
        let series = byKey.get(key)
        if (!series) {
          series = { key, name: programLabel(s.program as Program), metric: 'reps', points: [] }
          byKey.set(key, series)
        }
        series.points.push({ t, v: best })
      }
      continue
    }

    for (const log of s.exerciseLogs ?? []) {
      let entry = customPoints.get(log.exerciseId)
      if (!entry) {
        entry = {
          name: exerciseMap.get(log.exerciseId)?.name ?? log.exerciseId,
          byMetric: { e1rm: [], reps: [], duration: [] },
        }
        customPoints.set(log.exerciseId, entry)
      }
      for (const metric of ['e1rm', 'reps', 'duration'] as const) {
        let best = 0
        for (const set of log.sets) {
          const v = bestSetValue(set, metric)
          if (v > best) best = v
        }
        if (best > 0) entry.byMetric[metric].push({ t, v: best })
      }
    }
  }

  // Dla custom exercises wybierz metrykę z największym pokryciem; preferuj
  // e1rm > reps > duration przy remisie (siła z ciężarem jest bardziej
  // predykcyjna niż suche powtórzenia).
  const metricRank: ForecastMetric[] = ['e1rm', 'reps', 'duration']
  for (const [exerciseId, entry] of customPoints) {
    let chosen: ForecastMetric | null = null
    let chosenPoints: RawPoint[] = []
    for (const metric of metricRank) {
      const pts = entry.byMetric[metric]
      if (pts.length > chosenPoints.length) {
        chosen = metric
        chosenPoints = pts
      }
    }
    if (!chosen || chosenPoints.length === 0) continue
    byKey.set(`custom:${exerciseId}`, {
      key: `custom:${exerciseId}`,
      name: entry.name,
      metric: chosen,
      points: chosenPoints,
    })
  }

  for (const series of byKey.values()) {
    series.points = toWeeklyMax(series.points)
  }
  return Array.from(byKey.values()).filter((s) => s.points.length > 0)
}

/** Regresja liniowa najmniejszych kwadratów: y = intercept + slope·x (x w dniach od t0). */
export function linearRegression(xs: number[], ys: number[]): {
  slope: number
  intercept: number
  r2: number
} {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 }
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX
    const dy = ys[i]! - meanY
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  if (sxx === 0) return { slope: 0, intercept: meanY, r2: 0 }
  const slope = sxy / sxx
  const intercept = meanY - slope * meanX
  const r2 = syy === 0 ? 1 : Math.min(1, Math.max(0, (sxy * sxy) / (sxx * syy)))
  return { slope, intercept, r2 }
}

/** Następny "okrągły" cel powyżej rekordu — ludzkie milestone'y, nie procenty. */
export function nextMilestone(best: number, metric: ForecastMetric): number {
  const step = metric === 'e1rm' ? 5 : metric === 'duration' ? 30 : 5
  if (!Number.isFinite(best) || best < 0) return step
  return Math.floor(best / step) * step + step
}

function confidenceFor(r2: number): ForecastConfidence {
  if (r2 >= 0.5) return 'high'
  if (r2 >= 0.25) return 'medium'
  return 'low'
}

function forecastSeries(series: Series): ExerciseForecast {
  const pts = series.points
  const t0 = pts[0]!.t
  const tLast = pts[pts.length - 1]!.t
  const spanDays = Math.round((tLast - t0) / DAY_MS)
  const currentBest = Math.max(...pts.map((p) => p.v))
  const lastValue = pts[pts.length - 1]!.v
  const milestone = nextMilestone(currentBest, series.metric)

  const base = {
    key: series.key,
    name: series.name,
    metric: series.metric,
    points: pts.length,
    spanDays,
    currentBest,
    lastValue,
    milestone,
    slopePerDay: 0,
    r2: 0,
    confidence: 'low' as ForecastConfidence,
    status: 'insufficient' as const,
    predictedDate: null,
  }

  if (pts.length < FORECAST_MIN_POINTS || spanDays < FORECAST_MIN_SPAN_DAYS) {
    return base
  }

  // Stale data guard — extrapolating a trend from sessions weeks ago would
  // produce dates in the past; report as insufficient instead.
  if (Date.now() - tLast > FORECAST_STALE_DAYS * DAY_MS) {
    return base
  }

  const xs = pts.map((p) => (p.t - t0) / DAY_MS)
  const ys = pts.map((p) => p.v)
  const { slope, intercept, r2 } = linearRegression(xs, ys)
  const confidence = confidenceFor(r2)

  if (slope <= 0) {
    return { ...base, slopePerDay: slope, r2, confidence, status: 'flat' }
  }

  // Dni od ostatniego punktu do milestone'u na prostej regresji.
  const xLast = xs[xs.length - 1]!
  const daysToGoal = (milestone - (intercept + slope * xLast)) / slope
  if (!Number.isFinite(daysToGoal) || daysToGoal < 0 || daysToGoal > FORECAST_MAX_HORIZON_DAYS) {
    return { ...base, slopePerDay: slope, r2, confidence, status: 'flat' }
  }

  // The regression may place the crossing in the recent past (milestone
  // mathematically due but not yet logged) — clamp to tomorrow so the UI
  // never shows a date that already passed.
  const predictedMs = Math.max(
    tLast + Math.ceil(daysToGoal) * DAY_MS,
    Date.now() + DAY_MS,
  )
  const predicted = new Date(predictedMs)
  return {
    ...base,
    slopePerDay: slope,
    r2,
    confidence,
    status: 'ok',
    predictedDate: predicted.toISOString().slice(0, 10),
  }
}

/**
 * Pełny pipeline: serie → prognozy. Sortowanie: 'ok' po najbliższej dacie,
 * potem 'flat' i 'insufficient' po liczbie punktów. Max FORECAST_MAX_ROWS.
 */
export function computeForecasts(
  sessions: LocalWorkoutSession[],
  exerciseMap: Map<string, { name: string }>,
): ExerciseForecast[] {
  const series = buildForecastSeries(sessions, exerciseMap)
  const forecasts = series.map(forecastSeries)

  const statusRank = { ok: 0, flat: 1, insufficient: 2 } as const
  forecasts.sort((a, b) => {
    const r = statusRank[a.status] - statusRank[b.status]
    if (r !== 0) return r
    if (a.status === 'ok' && b.status === 'ok') {
      return (a.predictedDate ?? '').localeCompare(b.predictedDate ?? '')
    }
    return b.points - a.points
  })
  return forecasts.slice(0, FORECAST_MAX_ROWS)
}
