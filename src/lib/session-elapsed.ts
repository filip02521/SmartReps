/** Wall-clock seconds between session start and end (or now while active). */
export function sessionWallClockSec(
  startedAt: string,
  endedAt?: string | null,
  nowMs: number = Date.now(),
): number {
  const start = new Date(startedAt).getTime()
  if (!Number.isFinite(start)) return 0
  const end = endedAt ? new Date(endedAt).getTime() : nowMs
  if (!Number.isFinite(end)) return 0
  return Math.max(0, Math.floor((end - start) / 1000))
}

/**
 * Finished-session duration for summaries/history.
 * Requires `completedAt` — never falls back to "now" (would inflate old imports).
 */
export function sessionCompletedWallClockSec(
  startedAt: string,
  completedAt?: string | null,
): number {
  if (!completedAt) return 0
  return sessionWallClockSec(startedAt, completedAt)
}

/** Elapsed session clock: `m:ss` or `h:mm:ss` when ≥ 1 hour. */
export function formatSessionElapsed(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}
