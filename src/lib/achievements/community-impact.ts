import { supabase } from '@/lib/supabase/client'
import type { AuthorImpactStats } from './types'
import { emptyImpact } from './snapshot'

export async function fetchAuthorImpact(): Promise<AuthorImpactStats> {
  if (!supabase) return emptyImpact()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return emptyImpact()

  const { data, error } = await supabase.rpc('get_community_author_impact')
  if (error || !data) return emptyImpact()

  const row = data as Record<string, unknown>
  return {
    likeTotal: Number(row.like_total ?? 0),
    importTotal: Number(row.import_total ?? 0),
    trainedTotal: Number(row.trained_total ?? 0),
    publishedCount: Number(row.published_count ?? 0),
    bestPlanImports: Number(row.best_plan_imports ?? 0),
    bestPlanTrained: Number(row.best_plan_trained ?? 0),
  }
}

export async function recordCommunityTrained(
  publicationId: string,
): Promise<{ trained_count: number; counted: boolean }> {
  if (!supabase) return { trained_count: 0, counted: false }
  const { data, error } = await supabase.rpc('record_community_trained', {
    p_publication_id: publicationId,
  })
  if (error) throw error
  const row = data as { trained_count?: number; counted?: boolean }
  return {
    trained_count: Number(row.trained_count ?? 0),
    counted: Boolean(row.counted),
  }
}
