import { db } from '@/lib/db'
import type { Program } from '@/data/plans/types'
import { subWeeks, startOfWeek, addDays, format, isSameDay } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'

export type HeatmapCell = {
  date: string
  label: string
  status: 'passed' | 'failed' | 'rest' | 'empty'
  detail?: string
}

export async function buildActivityHeatmap(
  program: Program,
  weeks = 12,
): Promise<HeatmapCell[][]> {
  const sessions = await db.workoutSessions.where('program').equals(program).toArray()
  const progress = await db.programProgress.where('program').equals(program).first()

  const today = new Date()
  const grid: HeatmapCell[][] = []

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = startOfWeek(subWeeks(today, w), { weekStartsOn: 1 })
    const row: HeatmapCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      const dateStr = format(date, 'yyyy-MM-dd')
      const daySessions = sessions.filter((s) => isSameDay(new Date(s.startedAt), date))

      let status: HeatmapCell['status'] = 'empty'
      let detail: string | undefined

      if (daySessions.some((s) => s.status === 'completed' && s.passed)) {
        status = 'passed'
        const s = daySessions.find((x) => x.passed)!
        detail = `Dzień ${s.dayNumber} · ${s.totalReps ?? 0} reps`
      } else if (daySessions.some((s) => s.status === 'completed' && s.passed === false)) {
        status = 'failed'
        detail = 'Dzień nieudany'
      } else if (
        progress?.nextWorkoutAfter &&
        isSameDay(date, new Date(progress.nextWorkoutAfter)) &&
        date <= today
      ) {
        status = 'rest'
        detail = 'Przerwa'
      }

      row.push({
        date: dateStr,
        label: format(date, 'd MMM', { locale: plLocale }),
        status,
        detail,
      })
    }
    grid.push(row)
  }
  return grid
}

export async function exportSessionsCsv(program: Program): Promise<string> {
  const sessions = await db.workoutSessions.where('program').equals(program).toArray()
  sessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  const header = 'data,session_id,program,cycle_id,day,attempt,status,passed,total_reps,sets'
  const rows = sessions.map((s) => {
    const sets = s.setResults.map((r) => `S${r.setNumber}:${r.actual}`).join('|')
    return [
      s.startedAt.slice(0, 10),
      s.id,
      s.program,
      s.cycleId,
      s.dayNumber,
      s.cycleAttempt,
      s.status,
      s.passed ?? '',
      s.totalReps ?? '',
      `"${sets}"`,
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
