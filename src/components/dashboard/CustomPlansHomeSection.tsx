import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { CustomPlanHomeCard } from '@/components/dashboard/CustomPlanHomeCard'
import { EmptyState } from '@/components/ux/Feedback'
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

export function CustomPlansHomeSection() {
  const navigate = useNavigate()
  const enabledIds = useAppStore((s) => s.settings.enabledCustomPlanIds)
  const filterExplicit = useAppStore((s) => s.settings.customPlansFilterExplicit)
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const [cards, setCards] = useState<CustomPlanHomeCardModel[]>([])
  const [extraPlanCount, setExtraPlanCount] = useState(0)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    void (async () => {
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
    })()
  }, [enabledIds, filterExplicit, lastSyncedAt, reloadTick])

  if (cards.length === 0) {
    if (filterExplicit && enabledIds.length === 0) {
      return (
        <section className="mt-8" aria-label={pl.homeCustomPlans}>
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
    return null
  }

  return (
    <section className="mt-8" aria-label={pl.homeCustomPlans}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="sr-text-h2 text-[var(--sr-text-primary)]">{pl.homeCustomPlans}</h2>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.homeCustomPlansHint}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => navigate('/plans?tab=mine')}>
          {pl.homeSeeAllCustom}
        </Button>
      </div>
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
    </section>
  )
}
