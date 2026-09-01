import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, PageLoader } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import {
  CustomProgressionDiffList,
  CustomSessionRecap,
} from '@/components/workout/CustomSessionRecap'
import { NoticeCard, LogIn } from '@/components/ux/NoticeCard'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { LocalWorkoutSession } from '@/lib/db'
import type { CustomProgramProgress, ExerciseDefinition } from '@/lib/exercise-model'
import { getCustomSessionComparison } from '@/lib/custom-session-comparison'
import { sessionTotalSets } from '@/lib/custom-session-stats'
import { daysUntilWorkout } from '@/lib/progress-engine'
import { shouldShowLoginCloudPrompt } from '@/lib/summary-actions'
import { shareCustomSessionCard } from '@/lib/share-card'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { track } from '@/lib/analytics'
import { trackShareCard } from '@/lib/analytics'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { releaseBodyScrollLock } from '@/hooks/useFocusTrap'

export default function CustomSessionSummary() {
  const { planId } = useParams<{ planId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const failedParam = searchParams.get('failed') === '1'
  const sessionId = searchParams.get('session')
  const hasSeenLoginCloudPrompt = useAppStore((s) => s.hasSeenLoginCloudPrompt)
  const setHasSeenLoginCloudPrompt = useAppStore((s) => s.setHasSeenLoginCloudPrompt)
  const loginPromptTrackedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<LocalWorkoutSession | null>(null)
  const [previous, setPrevious] = useState<LocalWorkoutSession | undefined>()
  const [planName, setPlanName] = useState<string | null>(null)
  const [progress, setProgress] = useState<CustomProgramProgress | null>(null)
  const [exerciseMap, setExerciseMap] = useState<Map<string, ExerciseDefinition>>(new Map())
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    releaseBodyScrollLock()
  }, [sessionId, failedParam])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setEmail(null)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null)
    })
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setLoading(false)
      return
    }
    void (async () => {
      setLoading(true)
      try {
        const s = await db.workoutSessions.get(sessionId)
        if (!s) {
          setSession(null)
          return
        }
        setSession(s)
        const resolvedPlanId = s.customPlanId ?? planId
        if (resolvedPlanId) {
          const [plan, prog, exercises, comparison] = await Promise.all([
            db.customPlans.get(resolvedPlanId),
            db.customProgramProgress.where('customPlanId').equals(resolvedPlanId).first(),
            db.exercises.toArray(),
            getCustomSessionComparison(resolvedPlanId, sessionId),
          ])
          setPlanName(plan?.name ?? null)
          setProgress(prog ?? null)
          setPrevious(comparison.previous)
          const map = new Map<string, ExerciseDefinition>()
          for (const ex of exercises) map.set(ex.id, ex)
          setExerciseMap(map)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [sessionId, planId])

  const sessionPassed = session?.passed !== false
  const showLoginPrompt =
    !loading &&
    session &&
    email !== undefined &&
    shouldShowLoginCloudPrompt({
      passed: sessionPassed,
      email,
      hasSeenLoginCloudPrompt,
    })

  useEffect(() => {
    if (!showLoginPrompt || loginPromptTrackedRef.current) return
    loginPromptTrackedRef.current = true
    track('login_cloud_prompt_shown')
  }, [showLoginPrompt])

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.loading} />
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
        <EmptyState
          icon={<LogoMark size={48} />}
          title={pl.sessionSummaryMissingTitle}
          description={pl.missingSessionHint}
          action={{
            label: pl.myPlansTitle,
            onClick: () => navigate('/plans?tab=mine'),
          }}
        />
        <Button variant="ghost" className="mt-3" fullWidth onClick={() => navigate('/')}>
          {pl.backHome}
        </Button>
      </div>
    )
  }

  const resolvedPlanId = session.customPlanId ?? planId
  const failed = session.passed === false || (session.passed == null && failedParam)
  const totalSets = sessionTotalSets(session)
  const exerciseCount = session.exerciseLogs?.length ?? 0
  const cycleComplete =
    !failed &&
    session.passed === true &&
    (progress?.status === 'cycle_complete' || !!session.progressionDiffJson)
  const daysLeft = daysUntilWorkout(
    progress?.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const dismissLoginPrompt = () => setHasSeenLoginCloudPrompt(true)

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader
        title={failed ? pl.customDayFailed : pl.customDayPassed}
        subtitle={
          failed && progress?.nextWorkoutAfter
            ? pl.restPrimaryLabel(pl.restIn(daysLeft))
            : planName
              ? pl.progressCustomSessionMeta(planName, session.dayNumber)
              : pl.dayLabel(session.dayNumber)
        }
      />

      {!failed && progress?.nextWorkoutAfter && progress.status === 'rest' && (
        <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
          {pl.nextWorkoutIn(daysLeft)}
        </p>
      )}

      {!failed && !(progress?.nextWorkoutAfter && progress.status === 'rest') && (
        <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{pl.customSummaryRecSuccess}</p>
      )}

      {failed && (
        <Card className="mt-4 border border-[var(--sr-error)] p-4">
          <p className="text-sm text-[var(--sr-error)]">{pl.customSummaryRecFail}</p>
          <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{pl.customSummaryFailPolicy}</p>
        </Card>
      )}

      {cycleComplete && (
        <p className="mt-2 text-sm font-medium text-[var(--sr-success)]">{pl.cycleComplete}</p>
      )}

      {session.progressionDiffJson && resolvedPlanId && (
        <CustomProgressionDiffList
          diffJson={session.progressionDiffJson}
          planId={resolvedPlanId}
        />
      )}

      <div className="mt-6">
        <CustomSessionRecap
          current={session}
          previous={previous}
          exerciseMap={exerciseMap}
        />
      </div>

      <p className="mt-3 text-center sr-text-body-sm text-[var(--sr-text-secondary)]">
        {pl.attemptShort(session.cycleAttempt)}
      </p>

      {showLoginPrompt && (
        <NoticeCard
          className="mt-6"
          tone="brand"
          icon={<LogIn size={20} strokeWidth={2.25} />}
          title={pl.standaloneLoginCoachTitle}
          message={pl.summaryLoginBackup}
          actionLabel={pl.standaloneLoginCoachCta}
          onAction={() => {
            dismissLoginPrompt()
            track('login_cloud_prompt_clicked')
            if (resolvedPlanId && planName) {
              useAppStore.getState().setPendingCustomStart({
                customPlanId: resolvedPlanId,
                planName,
                navigateToWorkout: session?.passed !== false,
              })
            }
            navigate('/setup/login', {
              state: {
                returnTo: `/workout/custom/${resolvedPlanId}/summary?session=${sessionId}`,
              },
            })
          }}
          dismissLabel={pl.standaloneLoginCoachDismiss}
          onDismiss={dismissLoginPrompt}
          stackActions
        />
      )}

      <div className="mt-6 flex flex-col gap-2">
        {!failed && planName && (
          <Button
            variant="secondary"
            size="touch"
            fullWidth
            disabled={sharing}
            onClick={() => {
              void (async () => {
                setSharing(true)
                try {
                  await shareCustomSessionCard({
                    planName,
                    dayNumber: session.dayNumber,
                    exerciseCount,
                    totalSets,
                    passed: true,
                  })
                  trackShareCard('custom', true)
                  showToast(pl.summaryShareDone, 'success')
                } catch {
                  showToast(pl.summaryShareFailed, 'error')
                } finally {
                  setSharing(false)
                }
              })()
            }}
          >
            {pl.summaryShare}
          </Button>
        )}
        {resolvedPlanId && (
          <Button
            size="touch"
            fullWidth
            onClick={() => navigate(`/plans?tab=mine`)}
          >
            {pl.customSummaryBackToPlan}
          </Button>
        )}
        <Button variant="secondary" fullWidth onClick={() => navigate('/progress?tab=custom')}>
          {pl.customSummaryViewProgress}
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
        <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
          {pl.backHome}
        </Button>
      </div>
    </div>
  )
}
