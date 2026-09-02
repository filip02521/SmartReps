import type { CommunityPublicationRow, CommunitySort } from '@/lib/community-api'

export function sortCommunityRows(
  rows: CommunityPublicationRow[],
  sort: CommunitySort,
): CommunityPublicationRow[] {
  const copy = [...rows]
  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)
  copy.sort((a, b) => {
    if (sort === 'popular') {
      if (b.like_count !== a.like_count) return b.like_count - a.like_count
      if (b.import_count !== a.import_count) return b.import_count - a.import_count
      return time(b.published_at) - time(a.published_at)
    }
    if (sort === 'imports') {
      if (b.import_count !== a.import_count) return b.import_count - a.import_count
      if (b.like_count !== a.like_count) return b.like_count - a.like_count
      return time(b.published_at) - time(a.published_at)
    }
    return time(b.published_at) - time(a.published_at)
  })
  return copy
}
