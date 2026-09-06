import { db } from '@/lib/db'
import type { Program } from '@/data/plans/types'
import { subWeeks, startOfWeek, addDays, format, isSameDay } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'
import { pl } from '@/i18n/pl'
import { isCustomProgressHistorySession, isProgressHistorySession } from '@/lib/progress-history'

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
        label: format(date, 'd MMM', { locale: dateFnsLocale() }),
        status,
        detail,
      })
    }
    grid.push(row)
  }
  return grid
}

export async function exportSessionsCsv(program: Program): Promise<string> {
  const sessions = (
    await db.workoutSessions.where('program').equals(program).toArray()
  ).filter(isProgressHistorySession)
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

export async function exportCustomSessionsCsv(): Promise<string> {
  const sessions = (await db.workoutSessions.toArray())
    .filter(isCustomProgressHistorySession)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  const header =
    'data,session_id,program,custom_plan_id,cycle_id,day,attempt,status,passed,total_reps,exercise_logs'
  const rows = sessions.map((s) => {
    const logs = s.exerciseLogs
      ? JSON.stringify(s.exerciseLogs).replace(/"/g, '""')
      : ''
    return [
      s.startedAt.slice(0, 10),
      s.id,
      s.program,
      s.customPlanId ?? '',
      s.cycleId,
      s.dayNumber,
      s.cycleAttempt,
      s.status,
      s.passed ?? '',
      s.totalReps ?? '',
      `"${logs}"`,
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

/** Merge multiple program CSV exports into one file (single header, sorted by date).
 *  Handles both builtin (10-col) and custom (11-col) session CSVs by normalizing
 *  to the superset header: data,session_id,program,custom_plan_id,cycle_id,day,attempt,status,passed,total_reps,sets,exercise_logs
 */
export function mergeSessionCsvExports(csvChunks: string[]): string {
  const header =
    'data,session_id,program,custom_plan_id,cycle_id,day,attempt,status,passed,total_reps,sets,exercise_logs'
  const dataRows: string[] = []
  for (const chunk of csvChunks) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
    // Detect chunk format by inspecting its header line
    const chunkHeader = lines[0] ?? ''
    const isCustomFormat = chunkHeader.includes('custom_plan_id')
    const isBuiltinFormat =
      chunkHeader.startsWith('data,session_id,program,cycle_id,') && !isCustomFormat
    for (const line of lines) {
      if (line.startsWith('data,session_id,')) continue // skip any header
      if (isCustomFormat) {
        // Custom format: data,session_id,program,custom_plan_id,cycle_id,day,attempt,status,passed,total_reps,exercise_logs
        // → insert empty sets column before exercise_logs
        const cols = splitCsvRow(line)
        if (cols.length >= 11) {
          // Insert empty "sets" column at index 10 (before exercise_logs)
          const normalized = [
            ...cols.slice(0, 10),
            '""', // sets (builtin-only field, empty for custom)
            cols[10] ?? '""', // exercise_logs
          ]
          dataRows.push(normalized.join(','))
        } else {
          dataRows.push(line)
        }
      } else if (isBuiltinFormat) {
        // Builtin format: data,session_id,program,cycle_id,day,attempt,status,passed,total_reps,sets
        // → insert empty custom_plan_id after program, empty exercise_logs at end
        const cols = splitCsvRow(line)
        if (cols.length >= 10) {
          const normalized = [
            cols[0], // data
            cols[1], // session_id
            cols[2], // program
            '', // custom_plan_id (empty for builtin)
            cols[3], // cycle_id
            cols[4], // day
            cols[5], // attempt
            cols[6], // status
            cols[7], // passed
            cols[8], // total_reps
            cols[9], // sets
            '""', // exercise_logs (empty for builtin)
          ]
          dataRows.push(normalized.join(','))
        } else {
          dataRows.push(line)
        }
      } else {
        dataRows.push(line)
      }
    }
  }
  dataRows.sort((a, b) => a.localeCompare(b))
  return [header, ...dataRows].join('\n')
}

/** Split a CSV row respecting quoted fields. */
function splitCsvRow(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
        cur += ch
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
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
