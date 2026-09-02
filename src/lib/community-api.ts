import { supabase } from '@/lib/supabase/client'
import type { CommunityTag } from '@/data/community-tags'
import type { CommunitySnapshot } from '@/lib/community-snapshot'
import { parseCommunitySnapshot } from '@/lib/community-snapshot'
import { sortCommunityRows } from '@/lib/community-sort'

export type CommunityPublicationStatus = 'published' | 'unpublished' | 'hidden' | 'removed'

export type CommunityPublicationRow = {
  id: string
  author_id: string
  source_custom_plan_id: string
  slug: string
  title: string
  description: string
  tags: string[]
  snapshot_json: CommunitySnapshot
  author_display_name: string
  like_count: number
  import_count: number
  content_version: number
  status: CommunityPublicationStatus
  published_at: string | null
  first_published_at: string | null
  updated_at: string
}

export type CommunitySort = 'popular' | 'newest' | 'imports'

function mapRow(row: Record<string, unknown>): CommunityPublicationRow {
  const snapshot = parseCommunitySnapshot(row.snapshot_json) ?? {
    schemaVersion: 1 as const,
    name: String(row.title ?? ''),
    description: String(row.description ?? ''),
    days: [],
    progression: null,
    deload: null,
    exercises: [],
  }
  return {
    id: String(row.id),
    author_id: String(row.author_id),
    source_custom_plan_id: String(row.source_custom_plan_id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description ?? ''),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    snapshot_json: snapshot,
    author_display_name: String(row.author_display_name),
    like_count: Number(row.like_count ?? 0),
    import_count: Number(row.import_count ?? 0),
    content_version: Number(row.content_version ?? 1),
    status: row.status as CommunityPublicationStatus,
    published_at: (row.published_at as string | null) ?? null,
    first_published_at: (row.first_published_at as string | null) ?? null,
    updated_at: String(row.updated_at),
  }
}

const LIST_SELECT =
  'id, author_id, source_custom_plan_id, slug, title, description, tags, snapshot_json, author_display_name, like_count, import_count, content_version, status, published_at, first_published_at, updated_at'

export async function listCommunityPublications(opts: {
  sort: CommunitySort
  tag?: CommunityTag | null
  limit?: number
}): Promise<CommunityPublicationRow[]> {
  let q = supabase
    .from('community_publications')
    .select(LIST_SELECT)
    .eq('status', 'published')
    .limit(opts.limit ?? 50)

  if (opts.tag) {
    q = q.contains('tags', [opts.tag])
  }

  if (opts.sort === 'popular') {
    q = q
      .order('like_count', { ascending: false })
      .order('import_count', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false })
  } else if (opts.sort === 'imports') {
    q = q
      .order('import_count', { ascending: false })
      .order('like_count', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false })
  } else {
    q = q.order('published_at', { ascending: false, nullsFirst: false })
  }

  const { data, error } = await q
  if (error) throw error
  return sortCommunityRows(
    (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    opts.sort,
  )
}

export async function fetchCommunityPublicationBySlug(
  slug: string,
): Promise<CommunityPublicationRow | null> {
  const { data, error } = await supabase
    .from('community_publications')
    .select(LIST_SELECT)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function fetchMyPublicationForPlan(
  sourceCustomPlanId: string,
): Promise<CommunityPublicationRow | null> {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('community_publications')
    .select(LIST_SELECT)
    .eq('author_id', uid)
    .eq('source_custom_plan_id', sourceCustomPlanId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listMyCommunityPublications(): Promise<CommunityPublicationRow[]> {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) return []
  const { data, error } = await supabase
    .from('community_publications')
    .select(LIST_SELECT)
    .eq('author_id', uid)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function publishCommunityPlan(args: {
  sourceCustomPlanId: string
  title: string
  description: string
  tags: CommunityTag[]
  snapshot: CommunitySnapshot
  slug: string
  authorDisplayName: string
}): Promise<CommunityPublicationRow> {
  const { data, error } = await supabase.rpc('publish_community_plan', {
    p_source_custom_plan_id: args.sourceCustomPlanId,
    p_title: args.title,
    p_description: args.description,
    p_tags: args.tags,
    p_snapshot_json: args.snapshot,
    p_slug: args.slug,
    p_author_display_name: args.authorDisplayName,
  })
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function unpublishCommunityPlan(publicationId: string): Promise<CommunityPublicationRow> {
  const { data, error } = await supabase.rpc('unpublish_community_plan', {
    p_publication_id: publicationId,
  })
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function toggleCommunityLike(
  publicationId: string,
): Promise<{ liked: boolean; like_count: number }> {
  const { data, error } = await supabase.rpc('toggle_community_like', {
    p_publication_id: publicationId,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('self_like_forbidden')) {
      const err = new Error('self_like_forbidden')
      throw err
    }
    if (msg.includes('not_authenticated')) {
      throw new Error('not_authenticated')
    }
    if (msg.includes('not_found')) {
      throw new Error('not_found')
    }
    throw error
  }
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  const row = raw as { liked?: boolean; like_count?: number }
  return { liked: Boolean(row.liked), like_count: Number(row.like_count ?? 0) }
}

export async function recordCommunityImport(
  publicationId: string,
): Promise<{ import_count: number; counted: boolean }> {
  const { data, error } = await supabase.rpc('record_community_import', {
    p_publication_id: publicationId,
  })
  if (error) throw error
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  const row = raw as { import_count?: number; counted?: boolean }
  return {
    import_count: Number(row.import_count ?? 0),
    counted: Boolean(row.counted),
  }
}

export async function reportCommunityPublication(
  publicationId: string,
  reason: 'spam' | 'unsafe' | 'other',
): Promise<void> {
  const { error } = await supabase.rpc('report_community_publication', {
    p_publication_id: publicationId,
    p_reason: reason,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('self_report_forbidden')) {
      throw new Error('self_report_forbidden')
    }
    throw error
  }
}

export async function refreshCommunityAuthorDisplayName(displayName: string): Promise<void> {
  const { error } = await supabase.rpc('refresh_community_author_display_name', {
    p_display_name: displayName,
  })
  if (error) throw error
}

export async function fetchMyLikedPublicationIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return new Set()
  const { data, error } = await supabase
    .from('community_likes')
    .select('publication_id')
    .in('publication_id', ids)
  if (error) throw error
  return new Set((data ?? []).map((r) => String(r.publication_id)))
}
