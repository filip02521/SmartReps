import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { BrandLoader } from '@/components/ui/BrandLoader'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { LocalWorkoutSession } from '@/lib/db'
import {
  computeCustomSessionDetail,
  formatCustomSessionSummary,
  sessionTotalSets,
} from '@/lib/custom-session-stats'

export default function CustomSessionSummary() {
  const { planId } = useParams<{ planId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const failed = searchParams.get('failed') === '1'
  const sessionId = searchParams.get('session')
  const [session, setSession] = useState<LocalWorkoutSession | null | undefined>(undefined)
  const [planName, setPlanName] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      return
    }
    void (async () => {
      const s = await db.workoutSessions.get(sessionId)
      setSession(s ?? null)
      if (s?.customPlanId) {
        const plan = await db.customPlans.get(s.customPlanId)
        setPlanName(plan?.name ?? null)
      }
    })()
  }, [sessionId])

  if (session === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandLoader size={44} />
      </div>
    )
  }

  if (
    !session ||
    session.status !== 'completed' ||
    (planId && session.customPlanId && session.customPlanId !== planId)
  ) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <PageHeader title={pl.missingSession} />
        <Button className="mt-6" fullWidth onClick={() => navigate('/plans?tab=mine')}>
          {pl.myPlansTitle}
        </Button>
      </div>
    )
  }

  const exerciseCount = session.exerciseLogs?.length ?? 0
  const totalSets = sessionTotalSets(session)
  const detail = computeCustomSessionDetail(session.exerciseLogs)
  const resolvedPlanId = session.customPlanId ?? planId
  const cycleComplete = !failed && session.passed === true

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader
        title={failed ? pl.customDayFailed : pl.customDayPassed}
        subtitle={
          planName
            ? pl.progressCustomSessionMeta(planName, session.dayNumber)
            : pl.dayLabel(session.dayNumber)
        }
      />
      {cycleComplete && (
        <p className="mt-2 text-sm font-medium text-[var(--sr-success)]">{pl.cycleComplete}</p>
      )}
      <p className="mt-4 text-[var(--sr-text-secondary)]">
        {formatCustomSessionSummary(exerciseCount, totalSets, detail)}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {resolvedPlanId && (
          <Button
            size="touch"
            fullWidth
            onClick={() => navigate(`/workout/custom/${resolvedPlanId}`)}
          >
            {pl.customSummaryBackToPlan}
          </Button>
        )}
        <Button variant="secondary" fullWidth onClick={() => navigate('/progress?tab=custom')}>
          {pl.customSummaryViewProgress}
        </Button>
        <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
          {pl.backHome}
        </Button>
        {failed && resolvedPlanId && (
          <Button
            variant="ghost"
            fullWidth
            onClick={() => navigate(`/workout/custom/${resolvedPlanId}?force=1`)}
          >
            {pl.customFailRetryDay}
          </Button>
        )}
      </div>
    </div>
  )
}
