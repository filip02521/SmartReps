import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { CommunityPlanCard } from '@/components/community/CommunityPlanCard'
import { pl } from '@/i18n/pl'
import { useOnline } from '@/hooks/useOnline'
import {
  listCommunityPublications,
  type CommunityPublicationRow,
} from '@/lib/community-api'
import { getCommunityListCache } from '@/lib/community-list-cache'
import { supabase } from '@/lib/supabase/client'

const TEASER_LIMIT = 3
const FETCH_LIMIT = 12

function withoutOwn(
  rows: CommunityPublicationRow[],
  userId: string | null,
): CommunityPublicationRow[] {
  if (!userId) return rows
  return rows.filter((r) => r.author_id !== userId)
}

/** Home teaser: other people's plans only — never the viewer's own publications. */
export function CommunityHomeTeaser() {
  const online = useOnline()
  const navigate = useNavigate()
  const [rows, setRows] = useState<CommunityPublicationRow[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id ?? null

      const apply = (list: CommunityPublicationRow[]) => {
        if (cancelled) return
        setRows(withoutOwn(list, userId).slice(0, TEASER_LIMIT))
      }

      if (!online) {
        apply(getCommunityListCache('popular', null) ?? [])
        return
      }

      const cached = getCommunityListCache('popular', null)
      if (cached?.length) apply(cached)

      try {
        const data = await listCommunityPublications({
          sort: 'popular',
          limit: FETCH_LIMIT,
        })
        apply(data)
      } catch {
        if (!cached?.length) apply(getCommunityListCache('popular', null) ?? [])
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [online])

  if (rows.length === 0) return null

  return (
    <section className="mt-8">
      <SectionHeader icon={Users} title={pl.communityTeaserTitle} />
      <p className="mb-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
        {pl.communityTeaserHint}
      </p>
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
        size="md"
        fullWidth
        className="mt-3"
        onClick={() => navigate('/plans?tab=community')}
      >
        {pl.communityTeaserCta}
      </Button>
    </section>
  )
}
