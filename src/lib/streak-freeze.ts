import { useEffect, useState } from 'react'
import { db, FREEZE_CHANGED_EVENT, type LocalWorkoutSession, type StreakFreezeRow } from '@/lib/db'
import { getWeekKey, startOfLocalWeek, loadFrozenWeekKeys } from '@/lib/stats-engine'
import { isPro } from '@/lib/subscription'
import { enqueueSync } from '@/lib/sync'

/** Max freezes a user can hold at once. Prevents banking a deep reserve. */
export const STREAK_FREEZE_BANK_CAP = 3

/** Max consecutive weeks a freeze can bridge — keeps the streak "recent". */
const MAX_GAP_WEEKS = 3

function getMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Change notification ──
// Components reading frozen weeks re-render when a freeze is granted or
// consumed in this tab. Remote merges from a sync pull dispatch the same
// window event (constant lives in db.ts — sync.ts can't import this module).
// The hooks below subscribe to both channels.
export { FREEZE_CHANGED_EVENT }
const listeners = new Set<() => void>()
function notifyFreezeChanged() {
  for (const fn of listeners) fn()
}

async function writeFreezeRow(row: StreakFreezeRow): Promise<boolean> {
  try {
    await db.streakFreezes.add(row)
  } catch {
    // ConstraintError = row exists (another tab/device already wrote it) —
    // deterministic ids make this a safe no-op.
    return false
  }
  void enqueueSync('streak_freezes', 'insert', row)
  notifyFreezeChanged()
  return true
}

/** All week keys covered by consumed freezes. */
export async function getFrozenWeekKeys(): Promise<Set<string>> {
  return loadFrozenWeekKeys()
}

/** Reactive frozen-weeks set for streak UI. */
export function useFrozenWeeks(): ReadonlySet<string> {
  const [frozen, setFrozen] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    let cancelled = false
    const reload = () => {
      void getFrozenWeekKeys().then((keys) => {
        if (!cancelled) setFrozen(keys)
      })
    }
    reload()
    listeners.add(reload)
    window.addEventListener(FREEZE_CHANGED_EVENT, reload)
    return () => {
      cancelled = true
      listeners.delete(reload)
      window.removeEventListener(FREEZE_CHANGED_EVENT, reload)
    }
  }, [])
  return frozen
}

export type FreezeBalance = { granted: number; used: number; available: number }

export async function getFreezeBalance(): Promise<FreezeBalance> {
  const rows = await db.streakFreezes.toArray()
  let granted = 0
  let used = 0
  for (const r of rows) {
    if (r.kind === 'grant') granted++
    else used++
  }
  return { granted, used, available: Math.max(0, granted - used) }
}

/** Reactive freeze balance (grants/uses/available) for streak UI. */
export function useFreezeBalance(): FreezeBalance {
  const [balance, setBalance] = useState<FreezeBalance>({ granted: 0, used: 0, available: 0 })
  useEffect(() => {
    let cancelled = false
    const reload = () => {
      void getFreezeBalance().then((b) => {
        if (!cancelled) setBalance(b)
      })
    }
    reload()
    listeners.add(reload)
    window.addEventListener(FREEZE_CHANGED_EVENT, reload)
    return () => {
      cancelled = true
      listeners.delete(reload)
      window.removeEventListener(FREEZE_CHANGED_EVENT, reload)
    }
  }, [])
  return balance
}

/**
 * Accrue this month's freeze for Pro users. Idempotent — the deterministic
 * 'grant-YYYY-MM' id makes repeat calls and cross-device runs safe. Skips
 * silently when the bank is full or the user isn't Pro.
 */
export async function ensureMonthlyFreezeGrant(now = new Date()): Promise<boolean> {
  if (!isPro()) return false
  const { available } = await getFreezeBalance()
  if (available >= STREAK_FREEZE_BANK_CAP) return false
  return writeFreezeRow({
    id: `grant-${getMonthKey(now)}`,
    kind: 'grant',
    weekKey: null,
    monthKey: getMonthKey(now),
    createdAt: now.toISOString(),
  })
}

/**
 * Weeks (most recent first) that would break the current streak and can be
 * bridged by freezes. Empty when the streak is intact, when the gap is older
 * than MAX_GAP_WEEKS, or when the bank can't cover the whole gap — a partial
 * freeze doesn't reconnect the run, so we never consume one.
 */
export async function findFreezableGapWeeks(
  passedSessions: LocalWorkoutSession[],
  now = new Date(),
): Promise<string[]> {
  const covered = new Set<string>()
  for (const s of passedSessions) {
    covered.add(getWeekKey(new Date(s.startedAt)))
  }
  const frozen = await getFrozenWeekKeys()
  const { available } = await getFreezeBalance()

  const cursor = startOfLocalWeek(now)
  // Current week is always alive — never needs a freeze.
  cursor.setDate(cursor.getDate() - 7)

  const gap: string[] = []
  // Check MAX_GAP_WEEKS gap weeks plus one anchor week — a 3-week gap ending
  // in a trained week at -4 is salvageable when the bank covers it.
  for (let i = 0; i <= MAX_GAP_WEEKS; i++) {
    const key = getWeekKey(cursor)
    if (covered.has(key) || frozen.has(key)) {
      // Reached a week that keeps the streak alive.
      return gap.length > 0 && gap.length <= available ? gap : []
    }
    gap.push(key)
    cursor.setDate(cursor.getDate() - 7)
  }
  // Gap deeper than we allow freezing — nothing salvageable.
  return []
}

/**
 * Consume freezes for every week in `findFreezableGapWeeks`. Returns the week
 * keys that were frozen (empty when nothing was needed or possible).
 */
export async function autoSaveStreak(
  passedSessions: LocalWorkoutSession[],
  now = new Date(),
): Promise<string[]> {
  if (!isPro()) return []
  const gap = await findFreezableGapWeeks(passedSessions, now)
  if (!gap.length) return []
  const saved: string[] = []
  for (const weekKey of gap) {
    const wrote = await writeFreezeRow({
      id: `use-${weekKey}`,
      kind: 'use',
      weekKey,
      monthKey: null,
      createdAt: now.toISOString(),
    })
    if (wrote) saved.push(weekKey)
  }
  return saved
}

/**
 * One-shot maintenance: grant this month's freeze (Pro), then rescue the
 * streak if last week(s) were skipped. Call once per dashboard load — both
 * steps are idempotent. Returns week keys saved by a freeze this run.
 */
export async function maintainStreakFreezes(
  completedSessions: LocalWorkoutSession[],
  now = new Date(),
): Promise<string[]> {
  await ensureMonthlyFreezeGrant(now)
  return autoSaveStreak(completedSessions, now)
}
