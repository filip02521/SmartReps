import { useCallback, useEffect, useState } from 'react'
import { Heart, Share2, Flag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSection } from '@/components/ui/PageSection'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, FeedbackBanner, PageLoader } from '@/components/ux/Feedback'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { PublishCommunitySheet } from '@/components/community/PublishCommunitySheet'
import { pl } from '@/i18n/pl'
import { useOnline } from '@/hooks/useOnline'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { setAuthReturnTo } from '@/lib/auth-sync'
import { getAccountSwitchPending } from '@/lib/account-switch-gate'
import { db } from '@/lib/db'
import type { CustomPlan } from '@/lib/exercise-model'
import {
  fetchCommunityPublicationBySlug,
  fetchMyLikedPublicationIds,
  reportCommunityPublication,
  toggleCommunityLike,
  unpublishCommunityPlan,
  type CommunityPublicationRow,
} from '@/lib/community-api'
import {
  hasLocalCommunityImport,
  importCommunityPublication,
} from '@/lib/community-import'
import { communityTagLabel } from '@/lib/community-labels'
import {
  clearCommunityListCache,
  getCommunityDetailCache,
  patchCommunityPublicationInCaches,
  setCommunityDetailCache,
} from '@/lib/community-list-cache'
import { TAB_PAGE_SHELL, FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

type Props = {
  slug: string
  onBack?: () => void
}

export function CommunityPublicationView({ slug, onBack }: Props) {
  const navigate = useNavigate()
  const online = useOnline()
  const onboardingComplete = useAppStore((s) => s.settings.onboardingComplete)
  const [row, setRow] = useState<CommunityPublicationRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [unpublishOpen, setUnpublishOpen] = useState(false)
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [republishPlan, setRepublishPlan] = useState<CustomPlan | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setUnavailable(false)
    setFromCache(false)
    try {
      const { data } = await supabase.auth.getUser()
      setUserId(data.user?.id ?? null)

      if (!online) {
        const cached = getCommunityDetailCache(slug)
        if (cached && (cached.status === 'published' || cached.author_id === data.user?.id)) {
          setRow(cached)
          setFromCache(true)
          return
        }
        setUnavailable(true)
        setRow(null)
        return
      }

      const pub = await fetchCommunityPublicationBySlug(slug)
      if (!pub || (pub.status !== 'published' && pub.author_id !== data.user?.id)) {
        setUnavailable(true)
        setRow(null)
        return
      }
      setRow(pub)
      setCommunityDetailCache(pub)
      if (data.user?.id && pub.status === 'published') {
        const likedIds = await fetchMyLikedPublicationIds([pub.id])
        setLiked(likedIds.has(pub.id))
      } else {
        setLiked(false)
      }
    } catch {
      const cached = getCommunityDetailCache(slug)
      if (cached) {
        setRow(cached)
        setFromCache(true)
        setUnavailable(false)
      } else {
        setUnavailable(true)
        setRow(null)
      }
    } finally {
      setLoading(false)
    }
  }, [slug, online])

  useEffect(() => {
    void load()
  }, [load])

  function goLogin() {
    const path = `/community/${slug}`
    setAuthReturnTo(path)
    navigate(`/setup/login?returnTo=${encodeURIComponent(path)}`)
  }

  function requireAuth(): boolean {
    if (!isSupabaseConfigured) {
      showToast(pl.communityErrorGeneric, 'error')
      return false
    }
    if (!userId) {
      showToast(pl.communityLoginRequired, 'info')
      goLogin()
      return false
    }
    if (!onboardingComplete) {
      setAuthReturnTo(`/community/${slug}`)
      navigate('/setup/onboarding')
      return false
    }
    if (getAccountSwitchPending()) {
      showToast(pl.communityAccountSwitchPending, 'warning')
      return false
    }
    return true
  }

  async function runImport() {
    if (!row) return
    setBusy(true)
    try {
      if (userId === row.author_id) {
        showToast(pl.communitySelfImportHint, 'info')
      }
      const { plan, importCount } = await importCommunityPublication(row.snapshot_json, {
        publicationId: row.id,
      })
      setRow({ ...row, import_count: importCount })
      patchCommunityPublicationInCaches(row.id, { import_count: importCount })
      showToast(pl.communityImportDone, 'success')
      navigate(`/plans?tab=mine&edit=${plan.id}`)
    } catch {
      showToast(pl.communityErrorGeneric, 'error')
    } finally {
      setBusy(false)
      setImportConfirmOpen(false)
    }
  }

  async function handleImport() {
    if (!row) return
    if (!online) {
      showToast(pl.communityNeedOnline, 'info')
      return
    }
    if (!requireAuth()) return
    if (await hasLocalCommunityImport(row.id)) {
      setImportConfirmOpen(true)
      return
    }
    await runImport()
  }

  async function handleLike() {
    if (!row) return
    if (!online) {
      showToast(pl.communityNeedOnline, 'info')
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
    if (!requireAuth()) return

    const prevLiked = liked
    const prevCount = row.like_count
    const nextLiked = !prevLiked
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1))
    setLiked(nextLiked)
    setRow({ ...row, like_count: nextCount })
    patchCommunityPublicationInCaches(row.id, { like_count: nextCount })
    setLikeBusy(true)
    try {
      const res = await toggleCommunityLike(row.id)
      setLiked(res.liked)
      setRow((current) => (current ? { ...current, like_count: res.like_count } : current))
      patchCommunityPublicationInCaches(row.id, { like_count: res.like_count })
      showToast(res.liked ? pl.communityLikeDone : pl.communityUnlikeDone, 'success')
    } catch (err) {
      setLiked(prevLiked)
      setRow((current) => (current ? { ...current, like_count: prevCount } : current))
      patchCommunityPublicationInCaches(row.id, { like_count: prevCount })
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
      setLikeBusy(false)
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/community/${slug}`
    try {
      if (navigator.share) {
        await navigator.share({ title: row?.title ?? pl.appName, url })
      } else {
        await navigator.clipboard.writeText(url)
        showToast(pl.communityShareCopied, 'success')
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        showToast(pl.communityShareCopied, 'success')
      } catch {
        showToast(pl.communityErrorGeneric, 'error')
      }
    }
  }

  async function handleReport(reason: 'spam' | 'unsafe' | 'other') {
    if (!row) return
    if (!online) {
      showToast(pl.communityNeedOnline, 'info')
      return
    }
    if (!requireAuth()) return
    setBusy(true)
    try {
      await reportCommunityPublication(row.id, reason)
      setReportOpen(false)
      showToast(pl.communityReportDone, 'success')
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'self_report_forbidden') {
        showToast(pl.communitySelfReportForbidden, 'info')
      } else {
        showToast(pl.communityErrorGeneric, 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  async function confirmUnpublish() {
    if (!row || !requireAuth()) return
    setBusy(true)
    try {
      const updated = await unpublishCommunityPlan(row.id)
      clearCommunityListCache()
      setCommunityDetailCache(updated)
      setRow(updated)
      setUnpublishOpen(false)
      showToast(pl.communityUnpublishDone, 'success')
    } catch {
      showToast(pl.communityErrorGeneric, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRepublish() {
    if (!row) return
    if (!online) {
      showToast(pl.communityNeedOnline, 'info')
      return
    }
    const plan = await db.customPlans.get(row.source_custom_plan_id)
    if (!plan) {
      showToast(pl.communityRepublishMissingPlan, 'info')
      navigate('/plans?tab=mine')
      return
    }
    setRepublishPlan(plan)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <PageLoader />
      </div>
    )
  }

  if (unavailable || !row) {
    return (
      <div className={TAB_PAGE_SHELL}>
        <PageHeader
          title={pl.communityUnavailable}
          onBack={onBack ?? (() => navigate('/plans?tab=community'))}
        />
        <EmptyState
          title={!online ? pl.communityOffline : pl.communityUnavailable}
          description={!online ? pl.communityOfflineUnavailable : pl.communityUnavailableHint}
        />
      </div>
    )
  }

  const isAuthor = userId === row.author_id
  const isPublished = row.status === 'published'
  const actionsDisabled = busy || !online
  const canLike = isPublished && !isAuthor

  return (
    <div className={cn(TAB_PAGE_SHELL, 'safe-top safe-bottom')}>
      <PageHeader
        title={row.title}
        subtitle={pl.communityByAuthor(row.author_display_name)}
        onBack={onBack ?? (() => navigate(onboardingComplete ? '/plans?tab=community' : '/'))}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {!isPublished && isAuthor && (
          <Badge variant="default">{pl.communityStatusUnpublished}</Badge>
        )}
        {isAuthor && <Badge variant="default">{pl.communityYourPlan}</Badge>}
      </div>

      {!online && (
        <div className="mt-3">
          <FeedbackBanner
            variant="info"
            message={fromCache ? pl.communityOfflineDetail : pl.communityNeedOnline}
          />
        </div>
      )}

      {row.description.trim() ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
          {row.description.trim()}
        </p>
      ) : null}

      {row.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {row.tags.map((t) => (
            <span
              key={t}
              className="rounded-[var(--sr-radius-full)] bg-[var(--sr-bg-muted)] px-2.5 py-1 text-xs text-[var(--sr-text-secondary)]"
            >
              {communityTagLabel(t)}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-[var(--sr-text-muted)]">
        {pl.communityDetailMeta(row.like_count, row.import_count)}
      </p>

      <div className="mt-5 space-y-2">
        {isPublished && userId && (
          <Button
            type="button"
            size="touch"
            fullWidth
            disabled={actionsDisabled}
            onClick={() => void handleImport()}
          >
            {busy ? pl.communityImporting : pl.communityImport}
          </Button>
        )}
        {isPublished && !userId && (
          <Button type="button" size="touch" fullWidth onClick={goLogin}>
            {pl.communityLoginToImport}
          </Button>
        )}

        <div className="flex gap-2">
          {canLike && (
            <Button
              type="button"
              variant={liked ? 'secondary' : 'ghost'}
              className="flex-1"
              disabled={likeBusy || !online}
              aria-pressed={liked}
              onClick={() => void handleLike()}
            >
              <Heart
                className={cn('mr-1.5 size-4', liked && 'fill-current')}
                aria-hidden
              />
              {liked ? pl.communityUnlike : pl.communityLike}
              {` · ${row.like_count}`}
            </Button>
          )}
          {!canLike && isPublished && (
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] px-3 text-sm text-[var(--sr-text-muted)]">
              <Heart className="size-4" aria-hidden />
              <span>{row.like_count}</span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => void handleShare()}
          >
            <Share2 className="size-4" aria-hidden />
            {pl.communityShare}
          </Button>
        </div>

        {isAuthor && isPublished && (
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={actionsDisabled}
            onClick={() => setUnpublishOpen(true)}
          >
            {pl.communityUnpublish}
          </Button>
        )}
        {isAuthor && !isPublished && (
          <Button
            type="button"
            size="touch"
            fullWidth
            disabled={!online}
            onClick={() => void handleRepublish()}
          >
            {pl.communityRepublish}
          </Button>
        )}
        {isPublished && !isAuthor && userId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            fullWidth
            className="text-[var(--sr-text-muted)]"
            disabled={!online}
            onClick={() => setReportOpen(true)}
          >
            <Flag className="size-3.5" aria-hidden />
            {pl.communityReport}
          </Button>
        )}
      </div>

      <PageSection title={pl.communityDetailDays} className="mt-8">
        <ul className="flex flex-col gap-2">
          {row.snapshot_json.days.map((day) => (
            <li
              key={day.dayNumber}
              className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5"
            >
              <div className="text-sm font-medium text-[var(--sr-text-primary)]">
                {pl.dayLabel(day.dayNumber)}
              </div>
              <ul className="mt-1.5 space-y-1 text-sm text-[var(--sr-text-secondary)]">
                {day.exercises.map((pe) => {
                  const ex = row.snapshot_json.exercises.find((e) => e.id === pe.exerciseId)
                  return (
                    <li key={`${day.dayNumber}-${pe.order}`} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{ex?.name ?? pl.planEllipsis}</span>
                      <span className="shrink-0 text-[var(--sr-text-muted)]">
                        {pl.planSetsShort(pe.sets.length)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </PageSection>

      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title={pl.communityReport}>
        <div className="flex flex-col gap-2 p-4">
          {(
            [
              ['spam', pl.communityReportSpam],
              ['unsafe', pl.communityReportUnsafe],
              ['other', pl.communityReportOther],
            ] as const
          ).map(([reason, label]) => (
            <button
              key={reason}
              type="button"
              className={cn(
                FOCUS_RING,
                'rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-3 text-left text-sm font-medium',
              )}
              disabled={busy || !online}
              onClick={() => void handleReport(reason)}
            >
              {label}
            </button>
          ))}
        </div>
      </Sheet>

      {unpublishOpen && (
        <ConfirmSheet
          title={pl.communityUnpublish}
          message={pl.communityUnpublishConfirm}
          confirmLabel={pl.communityUnpublish}
          variant="danger"
          onConfirm={() => void confirmUnpublish()}
          onCancel={() => setUnpublishOpen(false)}
        />
      )}

      {importConfirmOpen && (
        <ConfirmSheet
          title={pl.communityImport}
          message={pl.communityAlreadyImported}
          confirmLabel={pl.communityImportAgain}
          onConfirm={() => void runImport()}
          onCancel={() => setImportConfirmOpen(false)}
        />
      )}

      <PublishCommunitySheet
        plan={republishPlan}
        open={republishPlan != null}
        onClose={() => setRepublishPlan(null)}
        onPublished={() => {
          setRepublishPlan(null)
          void load()
        }}
      />
    </div>
  )
}
