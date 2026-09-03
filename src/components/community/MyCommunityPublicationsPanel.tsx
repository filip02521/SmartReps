import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorBanner, FeedbackBanner, SkeletonCard } from '@/components/ux/Feedback'
import { CommunityPlanCard } from '@/components/community/CommunityPlanCard'
import { CommunityImpactStrip } from '@/components/achievements/CommunityImpactStrip'
import { pl } from '@/i18n/pl'
import { useOnline } from '@/hooks/useOnline'
import {
  listMyCommunityPublications,
  type CommunityPublicationRow,
} from '@/lib/community-api'
import { fetchAuthorImpact } from '@/lib/achievements/community-impact'
import { emptyImpact } from '@/lib/achievements/snapshot'
import type { AuthorImpactStats, AchievementId } from '@/lib/achievements/types'
import { buildAchievementSnapshot } from '@/lib/achievements/snapshot'
import { pickInProgress } from '@/lib/achievements/evaluate'
import { getAllUnlocks } from '@/lib/achievements/store'
import { scheduleAchievementCheck } from '@/lib/achievements/schedule'

const MY_CACHE_KEY = 'smartreps-community-my-pubs'

function readMyCache(): CommunityPublicationRow[] {
  try {
    const raw = sessionStorage.getItem(MY_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CommunityPublicationRow[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeMyCache(rows: CommunityPublicationRow[]): void {
  try {
    sessionStorage.setItem(MY_CACHE_KEY, JSON.stringify(rows))
  } catch {
    /* ignore quota */
  }
}

export function MyCommunityPublicationsPanel() {
  const online = useOnline()
  const navigate = useNavigate()
  const [rows, setRows] = useState<CommunityPublicationRow[]>(() => readMyCache())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [impact, setImpact] = useState<AuthorImpactStats>(emptyImpact())
  const [nextAch, setNextAch] = useState<{
    id: AchievementId
    current: number
    target: number
  } | null>(null)

  const load = useCallback(async () => {
    if (!online) {
      setRows(readMyCache())
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await listMyCommunityPublications()
      setRows(data)
      writeMyCache(data)
      scheduleAchievementCheck()
      const imp = await fetchAuthorImpact()
      setImpact(imp)
      const snap = await buildAchievementSnapshot({ impact: imp })
      const unlocks = await getAllUnlocks()
      const next = pickInProgress(snap, new Set(unlocks.map((u) => u.id)), 1, {
        track: 'catalog',
      })[0] ?? null
      setNextAch(next)
    } catch {
      const cached = readMyCache()
      if (cached.length === 0) setError(pl.communityLoadError)
      else setRows(cached)
    } finally {
      setLoading(false)
    }
  }, [online])

  useEffect(() => {
    void load()
  }, [load])

  if (!online && rows.length === 0) {
    return <EmptyState title={pl.communityOffline} />
  }

  return (
    <div className="mt-4 space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start gap-1.5"
        onClick={() => navigate('/plans?tab=community')}
      >
        <ArrowLeft size={16} aria-hidden />
        {pl.plansTabCommunity}
      </Button>

      <h2 className="sr-text-h3 text-[var(--sr-text-primary)]">{pl.communityMyPublications}</h2>

      {!loading && (impact.likeTotal > 0 || impact.importTotal > 0 || impact.trainedTotal > 0 || rows.length > 0) && (
        <CommunityImpactStrip impact={impact} nextAchievement={nextAch} />
      )}

      {!online && rows.length > 0 && (
        <FeedbackBanner variant="info" message={pl.communityCachedOffline} />
      )}

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {loading && (
        <div className="flex flex-col gap-3">
          <SkeletonCard className="min-h-[5rem]" />
        </div>
      )}
      {!loading && rows.length === 0 && (
        <EmptyState
          title={pl.communityMyPublicationsEmpty}
          description={pl.communityMyPublicationsEmptyHint}
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
                showStatus
                isOwn
                onClick={() => navigate(`/community/${row.slug}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
