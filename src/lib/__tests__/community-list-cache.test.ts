import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearCommunityListCache,
  getCommunityDetailCache,
  getCommunityListCache,
  patchCommunityPublicationInCaches,
  setCommunityDetailCache,
  setCommunityListCache,
} from '@/lib/community-list-cache'
import { sortCommunityRows } from '@/lib/community-sort'
import type { CommunityPublicationRow } from '@/lib/community-api'

const sample = (
  id: string,
  overrides: Partial<CommunityPublicationRow> = {},
): CommunityPublicationRow =>
  ({
    id,
    author_id: 'a',
    source_custom_plan_id: 'p',
    slug: `slug-${id}`,
    title: 'T',
    description: '',
    tags: [],
    snapshot_json: {
      schemaVersion: 1,
      name: 'T',
      description: '',
      days: [],
      progression: null,
      deload: null,
      exercises: [],
    },
    author_display_name: 'Filip',
    like_count: 0,
    import_count: 0,
    content_version: 1,
    status: 'published',
    published_at: '2026-01-01T00:00:00.000Z',
    first_published_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as CommunityPublicationRow

describe('community list cache', () => {
  beforeEach(() => {
    clearCommunityListCache()
  })

  it('stores and returns rows by sort/tag', () => {
    setCommunityListCache('popular', 'home', [sample('1')])
    expect(getCommunityListCache('popular', 'home')?.map((r) => r.id)).toEqual(['1'])
    expect(getCommunityListCache('newest', 'home')).toBeNull()
  })

  it('clears all entries', () => {
    setCommunityListCache('imports', null, [sample('2')])
    clearCommunityListCache()
    expect(getCommunityListCache('imports', null)).toBeNull()
  })

  it('patches like_count and re-sorts popular lists', () => {
    setCommunityListCache('popular', null, [
      sample('low', { like_count: 1, published_at: '2026-01-02T00:00:00.000Z' }),
      sample('high', { like_count: 5, published_at: '2026-01-01T00:00:00.000Z' }),
    ])
    expect(getCommunityListCache('popular', null)?.map((r) => r.id)).toEqual(['high', 'low'])

    patchCommunityPublicationInCaches('low', { like_count: 10 })
    expect(getCommunityListCache('popular', null)?.map((r) => r.id)).toEqual(['low', 'high'])
    expect(getCommunityListCache('popular', null)?.[0]?.like_count).toBe(10)
  })

  it('stores detail cache by slug for offline detail', () => {
    const row = sample('d1', { slug: 'plan-abc', like_count: 2 })
    setCommunityDetailCache(row)
    expect(getCommunityDetailCache('plan-abc')?.id).toBe('d1')
    patchCommunityPublicationInCaches('d1', { like_count: 4 })
    expect(getCommunityDetailCache('plan-abc')?.like_count).toBe(4)
  })
})

describe('sortCommunityRows', () => {
  it('orders popular by likes then imports then date', () => {
    const rows = [
      sample('a', { like_count: 1, import_count: 9, published_at: '2026-03-01T00:00:00.000Z' }),
      sample('b', { like_count: 3, import_count: 0, published_at: '2026-01-01T00:00:00.000Z' }),
      sample('c', { like_count: 3, import_count: 2, published_at: '2026-02-01T00:00:00.000Z' }),
    ]
    expect(sortCommunityRows(rows, 'popular').map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('orders newest by published_at', () => {
    const rows = [
      sample('old', { published_at: '2026-01-01T00:00:00.000Z' }),
      sample('new', { published_at: '2026-06-01T00:00:00.000Z' }),
    ]
    expect(sortCommunityRows(rows, 'newest').map((r) => r.id)).toEqual(['new', 'old'])
  })
})
