import { supabase } from '@/lib/supabase/client'

export type CommunityReview = {
  id: string
  publication_id: string
  user_id: string
  rating: number
  comment: string
  created_at: string
  updated_at: string
}

export type ReviewSummary = {
  avg_rating: number
  review_count: number
}

export type ReviewWithAuthor = CommunityReview & {
  author_display_name: string
}

/**
 * Upsert (create or update) a review for a community publication.
 * One review per user per publication. Author cannot review own plan.
 */
export async function upsertCommunityReview(args: {
  publicationId: string
  rating: number
  comment?: string
}): Promise<CommunityReview> {
  const { data, error } = await supabase.rpc('upsert_community_review', {
    p_publication_id: args.publicationId,
    p_rating: args.rating,
    p_comment: args.comment ?? '',
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('self_review_forbidden')) throw new Error('self_review_forbidden')
    if (msg.includes('invalid_rating')) throw new Error('invalid_rating')
    if (msg.includes('comment_too_long')) throw new Error('comment_too_long')
    if (msg.includes('not_found')) throw new Error('not_found')
    if (msg.includes('not_authenticated')) throw new Error('not_authenticated')
    throw error
  }
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as CommunityReview
}

/**
 * Delete the current user's review for a publication.
 */
export async function deleteCommunityReview(publicationId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_community_review', {
    p_publication_id: publicationId,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('not_authenticated')) throw new Error('not_authenticated')
    throw error
  }
}

/**
 * Get review summary (avg rating + count) for a publication.
 */
export async function getCommunityReviewSummary(
  publicationId: string,
): Promise<ReviewSummary> {
  const { data, error } = await supabase.rpc('get_community_review_summary', {
    p_publication_id: publicationId,
  })
  if (error) throw error
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return {
    avg_rating: Number((raw as ReviewSummary)?.avg_rating ?? 0),
    review_count: Number((raw as ReviewSummary)?.review_count ?? 0),
  }
}

/**
 * Get the current user's review for a publication (if any).
 */
export async function getMyCommunityReview(
  publicationId: string,
): Promise<CommunityReview | null> {
  const { data, error } = await supabase.rpc('get_my_community_review', {
    p_publication_id: publicationId,
  })
  if (error) throw error
  if (!data) return null
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as CommunityReview
}

/**
 * List reviews for a publication (newest first).
 * Joins profiles to get author display name.
 */
export async function listCommunityReviews(
  publicationId: string,
  limit = 20,
): Promise<ReviewWithAuthor[]> {
  const { data, error } = await supabase
    .from('community_reviews')
    .select(`
      id,
      publication_id,
      user_id,
      rating,
      comment,
      created_at,
      updated_at
    `)
    .eq('publication_id', publicationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  if (!data || data.length === 0) return []

  // Fetch author display names from public_profiles (privacy-safe)
  const userIds = [...new Set(data.map((r) => r.user_id))]
  const { data: profiles, error: profileError } = await supabase
    .from('public_profiles')
    .select('user_id, display_name')
    .in('user_id', userIds)
  if (profileError) throw profileError

  const nameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.display_name as string ?? '']),
  )

  return data.map((r) => ({
    id: String(r.id),
    publication_id: String(r.publication_id),
    user_id: String(r.user_id),
    rating: Number(r.rating),
    comment: String(r.comment ?? ''),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    author_display_name: nameMap.get(String(r.user_id)) ?? '',
  }))
}
