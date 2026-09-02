import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { CommunitySnapshot } from '@/lib/community-snapshot'

vi.mock('@/lib/db', () => {
  const exercises = { put: vi.fn() }
  const customPlans = { put: vi.fn() }
  return {
    db: {
      exercises,
      customPlans,
      transaction: vi.fn(async (_mode: string, _t1: unknown, _t2: unknown, fn: () => Promise<void>) =>
        fn(),
      ),
    },
  }
})

vi.mock('@/lib/sync', () => ({
  enqueueSync: vi.fn(),
}))

vi.mock('@/lib/community-api', () => ({
  recordCommunityImport: vi.fn(async () => ({ import_count: 1, counted: true })),
}))

vi.mock('@/lib/auth-sync', () => ({
  runAuthenticatedSync: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'new-id'),
}))

import { db } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { recordCommunityImport } from '@/lib/community-api'
import { runAuthenticatedSync } from '@/lib/auth-sync'
import { importCommunityPublication } from '@/lib/community-import'
import { generateId } from '@/lib/utils'

const snapshot: CommunitySnapshot = {
  schemaVersion: 1,
  name: 'Plan X',
  description: 'Opis',
  progression: null,
  deload: { enabled: true, everyNCycles: 4, repsDelta: -1 },
  exercises: [
    { id: 'old-ex', name: 'Pompki', primaryMetric: 'reps', restDefaultSec: 90 },
  ],
  days: [
    {
      dayNumber: 1,
      restAfterDay: 1,
      exercises: [
        {
          exerciseId: 'old-ex',
          order: 0,
          sets: [{ reps: { kind: 'fixed', value: 8 } }],
          restBetweenSetsSec: 90,
        },
      ],
    },
  ],
}

describe('importCommunityPublication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let n = 0
    vi.mocked(generateId).mockImplementation(() => `id-${++n}`)
  })

  it('creates remapped draft with community source and deload', async () => {
    const { plan, importCount, counted } = await importCommunityPublication(snapshot, {
      publicationId: 'pub-1',
    })

    expect(plan.status).toBe('draft')
    expect(plan.source).toBe('community')
    expect(plan.communityPublicationId).toBe('pub-1')
    expect(plan.deload?.enabled).toBe(true)
    expect(plan.days[0]?.exercises[0]?.exerciseId).not.toBe('old-ex')
    expect(importCount).toBe(1)
    expect(counted).toBe(true)
    expect(db.exercises.put).toHaveBeenCalled()
    expect(db.customPlans.put).toHaveBeenCalled()
    expect(enqueueSync).toHaveBeenCalledWith('user_exercises', 'insert', expect.any(Object))
    expect(enqueueSync).toHaveBeenCalledWith('custom_plans', 'insert', expect.any(Object))
    expect(recordCommunityImport).toHaveBeenCalledWith('pub-1')
    expect(runAuthenticatedSync).toHaveBeenCalled()
  })
})
