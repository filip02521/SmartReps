import { db } from '@/lib/db'
import type { Program } from '@/data/plans/types'
import { subWeeks, startOfWeek, addDays, format, isSameDay } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { pl } from '@/i18n/pl'

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
        detail = pl.heatmapDayPassed(s.dayNumber, s.totalReps ?? 0)
      } else if (daySessions.some((s) => s.status === 'completed' && s.passed === false)) {
        status = 'failed'
        detail = pl.heatmapDayFailed
      } else if (
        progress?.nextWorkoutAfter &&
        isSameDay(date, new Date(progress.nextWorkoutAfter)) &&
        date <= today
      ) {
        status = 'rest'
        detail = pl.heatmapRest
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

/** Merge multiple program CSV exports into one file (single header, sorted by date). */
export function mergeSessionCsvExports(csvChunks: string[]): string {
  const header = 'data,session_id,program,cycle_id,day,attempt,status,passed,total_reps,sets'
  const dataRows: string[] = []
  for (const chunk of csvChunks) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
    for (const line of lines) {
      if (line === header) continue
      if (line.startsWith('data,session_id,')) continue
      dataRows.push(line)
    }
  }
  dataRows.sort((a, b) => a.localeCompare(b))
  return [header, ...dataRows].join('\n')
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
