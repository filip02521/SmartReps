import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { CustomPlanHomeCard } from '@/components/dashboard/CustomPlanHomeCard'
import { EmptyState, SkeletonCard } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import { pl } from '@/i18n/pl'
import { listCustomPlans, listExercises } from '@/lib/custom-plan-service'
import { getCustomPlanResumeInfo } from '@/lib/custom-plan-resume'
import {
  buildCustomPlanHomeCardModel,
  type CustomPlanHomeCardModel,
} from '@/lib/custom-plan-home-summary'
import { resolveHomeCustomPlans, countHiddenHomeCustomPlans } from '@/lib/enabled-custom-plans'
import { useAppStore } from '@/stores/app-store'
import { db } from '@/lib/db'

/** Custom plans block for home — always renders after load (skeleton / empty / cards). */
export function CustomPlansHomeSection({
  embedded = false,
  hideEmptyDiscover = false,
}: {
  embedded?: boolean
  /** When true, skip empty create/library CTAs (parent EmptyState already owns them). */
  hideEmptyDiscover?: boolean
}) {
  const navigate = useNavigate()
  const enabledIds = useAppStore((s) => s.settings.enabledCustomPlanIds)
  const filterExplicit = useAppStore((s) => s.settings.customPlansFilterExplicit)
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const [cards, setCards] = useState<CustomPlanHomeCardModel[]>([])
  const [extraPlanCount, setExtraPlanCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    void (async () => {
      try {
        const all = (await listCustomPlans()).filter((p) => p.status === 'active')
        const plans = resolveHomeCustomPlans(all, {
          enabledCustomPlanIds: enabledIds,
          customPlansFilterExplicit: filterExplicit,
        })
        setExtraPlanCount(
          countHiddenHomeCustomPlans(all, {
            enabledCustomPlanIds: enabledIds,
            customPlansFilterExplicit: filterExplicit,
          }),
        )
        const exercises = await listExercises()

        const models: CustomPlanHomeCardModel[] = []
        for (const plan of plans) {
          const progress =
            (await db.customProgramProgress.where('customPlanId').equals(plan.id).first()) ?? null
          const resume = await getCustomPlanResumeInfo(plan.id)
          const planSessions = await db.workoutSessions.where('customPlanId').equals(plan.id).toArray()
          const lastCompleted = planSessions
            .filter((s) => s.status === 'completed')
            .sort(
              (a, b) =>
                new Date(b.completedAt ?? b.startedAt).getTime() -
                new Date(a.completedAt ?? a.startedAt).getTime(),
            )[0]
          const lastFailed = !!lastCompleted && lastCompleted.passed === false
          models.push(
            buildCustomPlanHomeCardModel({
              plan,
              progress,
              resume,
              exercises,
              lastFailed,
            }),
          )
        }
        setCards(models)
      } catch {
        setCards([])
      } finally {
        setLoaded(true)
      }
    })()
  }, [enabledIds, filterExplicit, lastSyncedAt, reloadTick])

  // Reload when the page regains focus (e.g., returning from workout summary).
  useEffect(() => {
    const onFocus = () => setReloadTick((t) => t + 1)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setReloadTick((t) => t + 1)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const shellClass = embedded ? undefined : 'mt-8'
  const aria = pl.homeCustomPlans

  if (!loaded) {
    if (hideEmptyDiscover) return null
    return (
      <div className={shellClass} aria-busy aria-label={aria}>
        <SkeletonCard className="min-h-[6rem]" />
      </div>
    )
  }

  if (cards.length === 0) {
    if (hideEmptyDiscover) return null
    if (filterExplicit && enabledIds.length === 0) {
      return (
        <section className={shellClass} aria-label={aria}>
          <EmptyState
            icon={<LogoMark size={40} />}
            title={pl.customHomeEmptyTitle}
            description={pl.customHomeEmptyHint}
            action={{
              label: pl.customHomeEmptyCta,
              onClick: () => navigate('/profile'),
            }}
          />
        </section>
      )
    }
    return (
      <section className={shellClass} aria-label={aria}>
        {!embedded && (
          <div className="mb-3">
            <h2 className="sr-text-h2 text-[var(--sr-text-primary)]">{pl.homeCustomPlans}</h2>
            <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
              {pl.homeCustomEmptyDiscoverHint}
            </p>
          </div>
        )}
        {embedded && (
          <p className="mb-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.homeCustomEmptyDiscoverHint}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size={embedded ? 'md' : 'touch'}
            fullWidth
            variant={embedded ? 'secondary' : 'primary'}
            onClick={() => navigate('/plans?tab=mine')}
          >
            {pl.homeCustomEmptyCreate}
          </Button>
          <Button
            type="button"
            variant={embedded ? 'ghost' : 'secondary'}
            size="md"
            fullWidth
            onClick={() => navigate('/plans?tab=library')}
          >
            {pl.homeCustomEmptyLibrary}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className={shellClass} aria-label={aria}>
      {!embedded && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div>
            <h2 className="sr-text-h2 text-[var(--sr-text-primary)]">{pl.homeCustomPlans}</h2>
            <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.homeCustomPlansHint}</p>
          </div>
          <Button type="button" size="md" variant="ghost" onClick={() => navigate('/plans?tab=mine')}>
            {pl.homeSeeAllCustom}
          </Button>
        </div>
      )}
      {embedded && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">
            {pl.homeCustomPlans}
          </p>
          <Button type="button" size="md" variant="ghost" onClick={() => navigate('/plans?tab=mine')}>
            {pl.homeSeeAllCustom}
          </Button>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {cards.map((model) => (
          <li key={model.planId}>
            <CustomPlanHomeCard model={model} onUpdated={() => setReloadTick((t) => t + 1)} />
          </li>
        ))}
      </ul>
      {extraPlanCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          className="mt-2"
          fullWidth
          onClick={() => navigate('/plans?tab=mine')}
        >
          {pl.customHomeMorePlans(extraPlanCount)}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        className="mt-1"
        fullWidth
        onClick={() => navigate('/plans?tab=library')}
      >
        {pl.homeCustomEmptyLibrary}
      </Button>
    </section>
  )
}
