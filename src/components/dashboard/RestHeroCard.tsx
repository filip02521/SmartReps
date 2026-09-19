import { useNavigate } from 'react-router-dom'
import { Moon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { AccentCard } from '@/components/ui/ProgramAccentCard'
import { AccentIconBadge } from '@/components/dashboard/program-card/ProgramIconBadge'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { pl } from '@/i18n/pl'
import type { ProgramCardModel } from '@/lib/home-summary'

/** Hero shown when every configured program is resting — communicates the
 *  next scheduled day (with a set preview of what's coming) and still offers
 *  the train-anyway escape hatch. */
export function RestHeroCard({ card }: { card: ProgramCardModel }) {
  const navigate = useNavigate()
  const next = card.stats?.nextWorkoutLabel ?? pl.today
  const upcomingSets = card.currentDaySets
  return (
    <AccentCard accent={card.accent}>
      <div className="flex items-center gap-2.5">
        <AccentIconBadge accent={card.accent}>
          <Moon size={20} strokeWidth={2.25} />
        </AccentIconBadge>
        <h3 className="min-w-0 flex-1 break-words sr-text-h3 text-[var(--sr-text-primary)]">
          {pl.homeStatusRestHeadline}
        </h3>
        <Badge variant="default" size="sm">
          {card.label}
        </Badge>
      </div>
      <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
        {pl.homeStatusRestSubtitle(next)}
      </p>
      {upcomingSets && card.progress && (
        <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="sr-text-overline text-[var(--sr-text-muted)]">
              {pl.nextWorkout}
            </p>
            <p className="sr-text-body-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
              {pl.dayOfTotal(card.progress.currentDay, card.cycleDayCount)}
            </p>
          </div>
          <SetTargetsRow sets={upcomingSets} size="sm" />
        </div>
      )}
      <div className="mt-3 border-t border-[var(--sr-border-subtle)] pt-3">
        <Button
          type="button"
          variant="ghost"
          size="touch"
          fullWidth
          onClick={() => navigate(`/workout/${card.program}?force=1`)}
        >
          {pl.trainAnyway}
        </Button>
      </div>
    </AccentCard>
  )
}
