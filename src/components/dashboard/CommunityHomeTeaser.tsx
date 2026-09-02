import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageSection } from '@/components/ui/PageSection'
import { Button } from '@/components/ui/Button'
import { CommunityPlanCard } from '@/components/community/CommunityPlanCard'
import { pl } from '@/i18n/pl'
import { useOnline } from '@/hooks/useOnline'
import {
  listCommunityPublications,
  type CommunityPublicationRow,
} from '@/lib/community-api'
import { getCommunityListCache } from '@/lib/community-list-cache'

/** One home teaser block — does not replace existing dashboard content. */
export function CommunityHomeTeaser() {
  const online = useOnline()
  const navigate = useNavigate()
  const [rows, setRows] = useState<CommunityPublicationRow[]>([])

  useEffect(() => {
    const fromCache = () => {
      const cached = getCommunityListCache('popular', null)
      if (cached?.length) setRows(cached.slice(0, 3))
    }

    if (!online) {
      fromCache()
      return
    }

    let cancelled = false
    // Prefer full catalog cache so we never overwrite it with a truncated fetch.
    const cached = getCommunityListCache('popular', null)
    if (cached?.length) {
      setRows(cached.slice(0, 3))
    }

    void listCommunityPublications({ sort: 'popular', limit: 3 })
      .then((data) => {
        if (cancelled) return
        setRows(data.slice(0, 3))
      })
      .catch(() => {
        if (!cancelled) fromCache()
      })
    return () => {
      cancelled = true
    }
  }, [online])

  if (rows.length === 0) return null

  return (
    <PageSection title={pl.communityTeaserTitle} hint={pl.communityTeaserHint} className="mt-8">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id}>
            <CommunityPlanCard
              row={row}
              compact
              onClick={() => navigate(`/community/${row.slug}`)}
            />
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={() => navigate('/plans?tab=community')}
      >
        {pl.communityTeaserCta}
      </Button>
    </PageSection>
  )
}
