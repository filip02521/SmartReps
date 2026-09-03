import type { CommunityPublicationRow, CommunitySort } from '@/lib/community-api'
import type { CommunityTag } from '@/data/community-tags'
import { sortCommunityRows } from '@/lib/community-sort'

type CacheKey = string

type CacheEntry = {
  rows: CommunityPublicationRow[]
  at: number
}

const TTL_MS = 60_000
const DETAIL_TTL_MS = 10 * 60_000
const cache = new Map<CacheKey, CacheEntry>()
const detailBySlug = new Map<string, { row: CommunityPublicationRow; at: number }>()

function key(sort: CommunitySort, tag: CommunityTag | null | undefined): CacheKey {
  return `${sort}::${tag ?? ''}`
}

export function getCommunityListCache(
  sort: CommunitySort,
  tag?: CommunityTag | null,
): CommunityPublicationRow[] | null {
  const entry = cache.get(key(sort, tag))
  if (!entry) return null
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(key(sort, tag))
    return null
  }
  return entry.rows
}

export function setCommunityListCache(
  sort: CommunitySort,
  tag: CommunityTag | null | undefined,
  rows: CommunityPublicationRow[],
): void {
  const sorted = sortCommunityRows(rows, sort)
  cache.set(key(sort, tag), { rows: sorted, at: Date.now() })
  for (const row of sorted) {
    setCommunityDetailCache(row)
  }
}

export function setCommunityDetailCache(row: CommunityPublicationRow): void {
  detailBySlug.set(row.slug, { row, at: Date.now() })
}

export function getCommunityDetailCache(slug: string): CommunityPublicationRow | null {
  const entry = detailBySlug.get(slug)
  if (entry && Date.now() - entry.at <= DETAIL_TTL_MS) {
    return entry.row
  }
  return findCommunityPublicationInListCaches(slug)
}

export function findCommunityPublicationInListCaches(
  slug: string,
): CommunityPublicationRow | null {
  for (const entry of cache.values()) {
    if (Date.now() - entry.at > TTL_MS) continue
    const hit = entry.rows.find((r) => r.slug === slug)
    if (hit) return hit
  }
  return null
}

/** Keep list counts/order in sync after like/import without waiting for TTL. */
export function patchCommunityPublicationInCaches(
  publicationId: string,
  patch: Partial<Pick<CommunityPublicationRow, 'like_count' | 'import_count' | 'trained_count' | 'status'>>,
): void {
  for (const [k, entry] of cache.entries()) {
    const idx = entry.rows.findIndex((r) => r.id === publicationId)
    if (idx < 0) continue
    const nextRows = entry.rows.map((r) => (r.id === publicationId ? { ...r, ...patch } : r))
    const sort = k.split('::')[0] as CommunitySort
    cache.set(k, { rows: sortCommunityRows(nextRows, sort), at: Date.now() })
  }
  for (const [slug, entry] of detailBySlug.entries()) {
    if (entry.row.id !== publicationId) continue
    detailBySlug.set(slug, { row: { ...entry.row, ...patch }, at: Date.now() })
  }
}

export function clearCommunityListCache(): void {
  cache.clear()
  detailBySlug.clear()
}
