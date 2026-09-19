import { useNavigate } from 'react-router-dom'
import { Dumbbell, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { AccentCard } from '@/components/ui/ProgramAccentCard'
import { SessionElapsedLabel } from '@/components/workout/SessionElapsedLabel'
import { AccentIconBadge } from '@/components/dashboard/program-card/ProgramIconBadge'
import { pl } from '@/i18n/pl'
import type { LocalWorkoutSession } from '@/lib/db'

/** Hero card for the ad-hoc workout — used when it IS the next action
 *  (resumable session or nothing scheduled at all). The compact row variant
 *  lives in HomeTrainingSection's options list. */
export function FreeWorkoutHeroCard({
  session,
}: {
  session: LocalWorkoutSession | null
}) {
  const navigate = useNavigate()
  const active = session != null
  return (
    <AccentCard accent="var(--sr-brand-primary)">
      <div className="flex items-center gap-2.5">
        <AccentIconBadge accent="var(--sr-brand-primary)">
          <Dumbbell size={20} strokeWidth={2.25} />
        </AccentIconBadge>
        <h3 className="min-w-0 flex-1 break-words sr-text-h3 text-[var(--sr-text-primary)]">
          {pl.freeWorkoutTitle}
        </h3>
        <Badge variant={active ? 'info' : 'default'} size="sm">
          {active ? pl.statusInProgress : pl.freeWorkoutHeroBadge}
        </Badge>
      </div>
      <div className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
        {active ? (
          <SessionElapsedLabel startedAt={session.startedAt} />
        ) : (
          pl.freeWorkoutHeroHint
        )}
      </div>
      <div className="mt-3 border-t border-[var(--sr-border-subtle)] pt-3">
        <Button
          type="button"
          size="touch"
          fullWidth
          onClick={() => navigate('/workout/free')}
        >
          <span className="flex items-center justify-center gap-2">
            <Play size={18} className="fill-current" aria-hidden />
            {active ? pl.freeWorkoutResume : pl.freeWorkoutStart}
          </span>
        </Button>
      </div>
    </AccentCard>
  )
}
