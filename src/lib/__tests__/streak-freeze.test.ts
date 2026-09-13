/**
 * Streak freeze — grant/use lifecycle, gap detection, Pro gating, and
 * freeze-aware streak math. Dexie is replaced by an in-memory table;
 * isPro is driven by a hoisted flag.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalWorkoutSession, StreakFreezeRow } from '@/lib/db'

const rows = new Map<string, StreakFreezeRow>()
const proFlag = vi.hoisted(() => ({ value: true }))

vi.mock('@/lib/db', () => ({
  db: {
    streakFreezes: {
      add: vi.fn(async (row: StreakFreezeRow) => {
        if (rows.has(row.id)) throw new Error('ConstraintError')
        rows.set(row.id, row)
        return row.id
      }),
      put: vi.fn(async (row: StreakFreezeRow) => {
        rows.set(row.id, row)
        return row.id
      }),
      toArray: vi.fn(async () => [...rows.values()]),
      where: vi.fn((field: keyof StreakFreezeRow) => ({
        equals: (v: unknown) => ({
          toArray: async () => [...rows.values()].filter((r) => r[field] === v),
        }),
      })),
      clear: vi.fn(async () => rows.clear()),
    },
    workoutSessions: { toArray: vi.fn(async () => []) },
  },
}))

vi.mock('@/lib/subscription', () => ({
  isPro: () => proFlag.value,
}))

vi.mock('@/lib/sync', () => ({
  enqueueSync: vi.fn(async () => undefined),
}))

import {
  autoSaveStreak,
  ensureMonthlyFreezeGrant,
  findFreezableGapWeeks,
  getFreezeBalance,
  getFrozenWeekKeys,
  STREAK_FREEZE_BANK_CAP,
} from '@/lib/streak-freeze'
import { computeStreakWeeks, getWeekKey, startOfLocalWeek } from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import { getProfileTitle, isTitleId, titleRarity, TITLE_IDS } from '@/lib/achievements/titles'

function session(startedAt: string): LocalWorkoutSession {
  return {
    id: `s-${startedAt}`,
    program: 'pushups',
    cycleId: 'pushups-6-10',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    passed: true,
    totalReps: 30,
    setResults: [],
    startedAt,
  }
}

/** Monday of the week `n` weeks before `now`'s week, as ISO week key. */
function weekKeyBack(now: Date, n: number): string {
  const d = startOfLocalWeek(now)
  d.setDate(d.getDate() - 7 * n)
  return getWeekKey(d)
}

function sessionInWeek(now: Date, n: number): LocalWorkoutSession {
  const mon = startOfLocalWeek(now)
  mon.setDate(mon.getDate() - 7 * n + 2) // Wednesday — safely inside the week
  return session(mon.toISOString())
}

beforeEach(() => {
  rows.clear()
  proFlag.value = true
})

describe('computeStreakWeeks with frozenWeeks', () => {
  const now = new Date('2026-09-13T12:00:00') // Sunday of week W0

  it('returns 0 for no sessions even with a freeze — never fabricates a streak', () => {
    const frozen = new Set([weekKeyBack(now, 1)])
    expect(computeStreakWeeks([], now, frozen)).toBe(0)
  })

  it('freeze bridges a single missing week', () => {
    const sessions = [sessionInWeek(now, 3), sessionInWeek(now, 2)]
    const frozen = new Set([weekKeyBack(now, 1)])
    expect(computeStreakWeeks(sessions, now, frozen)).toBe(3)
    // Without the freeze the streak is already broken (gap at -1).
    expect(computeStreakWeeks(sessions, now)).toBe(0)
  })

  it('one freeze does not bridge a two-week gap', () => {
    const sessions = [sessionInWeek(now, 4), sessionInWeek(now, 3)]
    const frozen = new Set([weekKeyBack(now, 2)])
    expect(computeStreakWeeks(sessions, now, frozen)).toBe(0)
  })

  it('multiple freezes bridge a multi-week gap', () => {
    const sessions = [sessionInWeek(now, 4)]
    const frozen = new Set([weekKeyBack(now, 3), weekKeyBack(now, 2), weekKeyBack(now, 1)])
    expect(computeStreakWeeks(sessions, now, frozen)).toBe(4)
  })
})

describe('computeBestStreakWeeks with frozenWeeks', () => {
  const now = new Date('2026-09-13T12:00:00')

  it('counts a trailing freeze past the last session week', () => {
    const sessions = [sessionInWeek(now, 3), sessionInWeek(now, 2)]
    const frozen = new Set([weekKeyBack(now, 1)])
    expect(computeBestStreakWeeks(sessions, frozen, now)).toBe(3)
    expect(computeBestStreakWeeks(sessions, undefined, now)).toBe(2)
  })

  it('does not count a freeze with no anchoring sessions', () => {
    const sessions = [sessionInWeek(now, 6)]
    const frozen = new Set([weekKeyBack(now, 1)])
    expect(computeBestStreakWeeks(sessions, frozen, now)).toBe(1)
  })
})

describe('ensureMonthlyFreezeGrant', () => {
  const now = new Date('2026-09-13T12:00:00')

  it('grants one freeze per month for Pro', async () => {
    expect(await ensureMonthlyFreezeGrant(now)).toBe(true)
    expect(await getFreezeBalance()).toEqual({ granted: 1, used: 0, available: 1 })
    // Same month again — idempotent no-op.
    expect(await ensureMonthlyFreezeGrant(now)).toBe(false)
    expect((await getFreezeBalance()).granted).toBe(1)
  })

  it('grants again next month', async () => {
    await ensureMonthlyFreezeGrant(now)
    const next = new Date('2026-10-05T12:00:00')
    expect(await ensureMonthlyFreezeGrant(next)).toBe(true)
    expect((await getFreezeBalance()).granted).toBe(2)
  })

  it('blocks non-Pro users', async () => {
    proFlag.value = false
    expect(await ensureMonthlyFreezeGrant(now)).toBe(false)
    expect((await getFreezeBalance()).granted).toBe(0)
  })

  it('stops granting when the bank is full', async () => {
    for (let i = 0; i < STREAK_FREEZE_BANK_CAP; i++) {
      const d = new Date(2026, 8 + i, 13)
      await ensureMonthlyFreezeGrant(d)
    }
    expect((await getFreezeBalance()).available).toBe(STREAK_FREEZE_BANK_CAP)
    expect(await ensureMonthlyFreezeGrant(new Date(2026, 11, 13))).toBe(false)
    expect((await getFreezeBalance()).granted).toBe(STREAK_FREEZE_BANK_CAP)
  })
})

describe('findFreezableGapWeeks', () => {
  const now = new Date('2026-09-13T12:00:00')

  it('returns empty when the streak is intact', async () => {
    await ensureMonthlyFreezeGrant(now)
    const sessions = [sessionInWeek(now, 1), sessionInWeek(now, 2)]
    expect(await findFreezableGapWeeks(sessions, now)).toEqual([])
  })

  it('finds a one-week gap when a freeze is available', async () => {
    await ensureMonthlyFreezeGrant(now)
    const sessions = [sessionInWeek(now, 2), sessionInWeek(now, 3)]
    expect(await findFreezableGapWeeks(sessions, now)).toEqual([weekKeyBack(now, 1)])
  })

  it('returns empty when the bank cannot cover the whole gap', async () => {
    await ensureMonthlyFreezeGrant(now) // only 1 freeze
    const sessions = [sessionInWeek(now, 3)]
    // Two-week gap (-2, -1) needs 2 freezes.
    expect(await findFreezableGapWeeks(sessions, now)).toEqual([])
  })

  it('covers a three-week gap when the bank is full', async () => {
    for (let i = 0; i < 3; i++) await ensureMonthlyFreezeGrant(new Date(2026, 6 + i, 13))
    const sessions = [sessionInWeek(now, 4)]
    const gap = await findFreezableGapWeeks(sessions, now)
    expect(gap).toEqual([weekKeyBack(now, 1), weekKeyBack(now, 2), weekKeyBack(now, 3)])
  })

  it('returns empty when the gap is deeper than the freeze cap', async () => {
    for (let i = 0; i < 3; i++) await ensureMonthlyFreezeGrant(new Date(2026, 6 + i, 13))
    const sessions = [sessionInWeek(now, 5)]
    expect(await findFreezableGapWeeks(sessions, now)).toEqual([])
  })

  it('returns empty with no anchoring week — no streak to save', async () => {
    await ensureMonthlyFreezeGrant(now)
    const sessions = [sessionInWeek(now, 10)]
    expect(await findFreezableGapWeeks(sessions, now)).toEqual([])
  })

  it('skips weeks already frozen and only reports the missing rest', async () => {
    for (let i = 0; i < 2; i++) await ensureMonthlyFreezeGrant(new Date(2026, 6 + i, 13))
    // Week -2 already frozen by a previous auto-save.
    await db_addUse(weekKeyBack(now, 2))
    const sessions = [sessionInWeek(now, 3)]
    expect(await findFreezableGapWeeks(sessions, now)).toEqual([weekKeyBack(now, 1)])
  })
})

async function db_addUse(weekKey: string) {
  const { db } = await import('@/lib/db')
  await db.streakFreezes.add({
    id: `use-${weekKey}`,
    kind: 'use',
    weekKey,
    monthKey: null,
    createdAt: new Date().toISOString(),
  })
}

describe('autoSaveStreak', () => {
  const now = new Date('2026-09-13T12:00:00')

  it('consumes a freeze for the missing week', async () => {
    await ensureMonthlyFreezeGrant(now)
    const sessions = [sessionInWeek(now, 2)]
    const saved = await autoSaveStreak(sessions, now)
    expect(saved).toEqual([weekKeyBack(now, 1)])
    expect(await getFrozenWeekKeys()).toEqual(new Set([weekKeyBack(now, 1)]))
    expect((await getFreezeBalance()).available).toBe(0)
  })

  it('does nothing for non-Pro — even with a banked freeze', async () => {
    await ensureMonthlyFreezeGrant(now)
    proFlag.value = false
    const sessions = [sessionInWeek(now, 2)]
    expect(await autoSaveStreak(sessions, now)).toEqual([])
    expect((await getFrozenWeekKeys()).size).toBe(0)
  })

  it('is idempotent — a second run consumes nothing', async () => {
    await ensureMonthlyFreezeGrant(now)
    const sessions = [sessionInWeek(now, 2)]
    await autoSaveStreak(sessions, now)
    expect(await autoSaveStreak(sessions, now)).toEqual([])
    expect((await getFreezeBalance()).used).toBe(1)
  })
})

describe('profile titles', () => {
  it('accepts only allowlisted achievement ids', () => {
    expect(isTitleId('streak_12')).toBe(true)
    expect(isTitleId('legend_grandmaster')).toBe(true)
    expect(isTitleId('secret_night')).toBe(false)
    expect(isTitleId('nonexistent')).toBe(false)
    expect(isTitleId(null)).toBe(false)
    expect(isTitleId(undefined)).toBe(false)
  })

  it('resolves localized labels and rarity', () => {
    expect(getProfileTitle('streak_12')).toBeTruthy()
    expect(getProfileTitle('secret_night')).toBeNull()
    expect(titleRarity('legend_grandmaster')).toBe('legendary')
    expect(titleRarity('first_session')).toBeTruthy()
  })

  it('never exposes secret achievements as titles', () => {
    expect(TITLE_IDS).not.toContain('secret_night')
    expect(TITLE_IDS).not.toContain('secret_precision')
  })
})
