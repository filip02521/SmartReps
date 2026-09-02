import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorBanner, FeedbackBanner, SkeletonCard } from '@/components/ux/Feedback'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { CommunityPlanCard } from '@/components/community/CommunityPlanCard'
import { pl } from '@/i18n/pl'
import { useOnline } from '@/hooks/useOnline'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import {
  fetchMyLikedPublicationIds,
  listCommunityPublications,
  toggleCommunityLike,
  type CommunityPublicationRow,
  type CommunitySort,
} from '@/lib/community-api'
import {
  getCommunityListCache,
  patchCommunityPublicationInCaches,
  setCommunityListCache,
} from '@/lib/community-list-cache'
import { sortCommunityRows } from '@/lib/community-sort'
import { COMMUNITY_TAGS, type CommunityTag } from '@/data/community-tags'
import { communityTagLabel } from '@/lib/community-labels'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { setAuthReturnTo } from '@/lib/auth-sync'
import { getAccountSwitchPending } from '@/lib/account-switch-gate'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'

type Props = {
  showMyLink?: boolean
}

export function CommunityCatalogPanel({ showMyLink }: Props) {
  const online = useOnline()
  const navigate = useNavigate()
  const onboardingComplete = useAppStore((s) => s.settings.onboardingComplete)
  const [sort, setSort] = useState<CommunitySort>('popular')
  const [tag, setTag] = useState<CommunityTag | null>(null)
  const [rows, setRows] = useState<CommunityPublicationRow[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const load = useCallback(async () => {
    if (!online) {
      setLoading(false)
      setError(null)
      setRows(getCommunityListCache(sort, tag) ?? [])
      return
    }
    const cached = getCommunityListCache(sort, tag)
    if (cached) {
      setRows(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await listCommunityPublications({ sort, tag })
      setCommunityListCache(sort, tag, data)
      setRows(data)
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id ?? null
      setUserId(uid)
      if (uid && data.length > 0) {
        const liked = await fetchMyLikedPublicationIds(data.map((r) => r.id))
        setLikedIds(liked)
      } else {
        setLikedIds(new Set())
      }
    } catch {
      if (!cached) setError(pl.communityLoadError)
    } finally {
      setLoading(false)
    }
  }, [online, sort, tag])

  useEffect(() => {
    void load()
  }, [load])

  function goLogin() {
    const path = '/plans?tab=community'
    setAuthReturnTo(path)
    navigate(`/setup/login?returnTo=${encodeURIComponent(path)}`)
  }

  function applyLikeLocal(publicationId: string, likeCount: number, liked: boolean) {
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (liked) next.add(publicationId)
      else next.delete(publicationId)
      return next
    })
    setRows((prev) =>
      sortCommunityRows(
        prev.map((r) => (r.id === publicationId ? { ...r, like_count: likeCount } : r)),
        sort,
      ),
    )
    patchCommunityPublicationInCaches(publicationId, { like_count: likeCount })
  }

  async function handleLike(row: CommunityPublicationRow) {
    if (!online) {
      showToast(pl.communityNeedOnline, 'info')
      return
    }
    if (!isSupabaseConfigured) {
      showToast(pl.communityErrorGeneric, 'error')
      return
    }
    if (userId === row.author_id) {
      showToast(pl.communityLikeOwnForbidden, 'info')
      return
    }
    if (!userId) {
      showToast(pl.communityLoginToLike, 'info')
      goLogin()
      return
    }
    if (!onboardingComplete) {
      setAuthReturnTo('/plans?tab=community')
      navigate('/setup/onboarding')
      return
    }
    if (getAccountSwitchPending()) {
      showToast(pl.communityAccountSwitchPending, 'warning')
      return
    }

    const prevLiked = likedIds.has(row.id)
    const prevCount = row.like_count
    const nextLiked = !prevLiked
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1))
    applyLikeLocal(row.id, nextCount, nextLiked)
    setLikeBusyId(row.id)
    try {
      const res = await toggleCommunityLike(row.id)
      applyLikeLocal(row.id, res.like_count, res.liked)
      showToast(res.liked ? pl.communityLikeDone : pl.communityUnlikeDone, 'success')
    } catch (err) {
      applyLikeLocal(row.id, prevCount, prevLiked)
      const code = err instanceof Error ? err.message : ''
      if (code === 'self_like_forbidden') {
        showToast(pl.communityLikeOwnForbidden, 'info')
      } else if (code === 'not_authenticated') {
        showToast(pl.communityLoginToLike, 'info')
        goLogin()
      } else {
        showToast(pl.communityErrorGeneric, 'error')
      }
    } finally {
      setLikeBusyId(null)
    }
  }

  if (!online && rows.length === 0) {
    return (
      <EmptyState title={pl.communityOffline} description={pl.plansCommunityPageHint} />
    )
  }

  return (
    <div className="mt-4 space-y-3 pb-2">
      {!online && rows.length > 0 && (
        <FeedbackBanner variant="info" message={pl.communityCachedOffline} />
      )}

      <SegmentedControl
        size="compact"
        value={sort}
        onChange={(v) => setSort(v)}
        options={[
          { value: 'popular', label: pl.communitySortPopular },
          { value: 'newest', label: pl.communitySortNewest },
          { value: 'imports', label: pl.communitySortImports },
        ]}
      />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          className={cn(
            FOCUS_RING,
            'shrink-0 rounded-[var(--sr-radius-full)] px-2.5 py-1.5 text-xs font-medium',
            tag == null
              ? 'bg-[var(--sr-brand-primary-muted)] font-semibold text-[var(--sr-brand-primary)]'
              : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
          )}
          onClick={() => setTag(null)}
        >
          {pl.communityFilterAll}
        </button>
        {COMMUNITY_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className={cn(
              FOCUS_RING,
              'shrink-0 rounded-[var(--sr-radius-full)] px-2.5 py-1.5 text-xs font-medium',
              tag === t
                ? 'bg-[var(--sr-brand-primary-muted)] font-semibold text-[var(--sr-brand-primary)]'
                : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
            )}
            onClick={() => setTag(t === tag ? null : t)}
          >
            {communityTagLabel(t)}
          </button>
        ))}
      </div>

      {showMyLink && userId && isSupabaseConfigured && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/plans?tab=community&mine=1')}
          >
            {pl.communityMyPublications}
          </Button>
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {loading && (
        <div className="flex flex-col gap-3">
          <SkeletonCard className="min-h-[5.5rem]" />
          <SkeletonCard className="min-h-[5.5rem]" />
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title={pl.communityEmpty}
          description={pl.communityEmptyHint}
          action={{
            label: pl.communityEmptyCta,
            onClick: () => navigate('/plans?tab=mine'),
          }}
        />
      )}
      {!loading && rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <CommunityPlanCard
                row={row}
                liked={likedIds.has(row.id)}
                isOwn={userId === row.author_id}
                likeDisabled={likeBusyId === row.id || !online}
                onLike={
                  userId === row.author_id ? undefined : () => void handleLike(row)
                }
                onClick={() => navigate(`/community/${row.slug}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
