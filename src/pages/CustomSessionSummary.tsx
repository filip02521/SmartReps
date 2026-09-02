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
import type {
  CustomPlan,
  CustomProgramProgress,
  ExerciseDefinition,
} from '@/lib/exercise-model'
import {
  customSessionHasBelowTarget,
  getCustomSessionComparison,
} from '@/lib/custom-session-comparison'
import {
  applySessionLogsToPlanDay,
  buildSessionPlanChanges,
  isPlanUpdateDeclined,
  markPlanUpdateDeclined,
  parseSessionDayPatchJson,
  sessionSuggestsPlanUpdate,
} from '@/lib/custom-plan-session-patch'
import { saveCustomPlan } from '@/lib/custom-plan-service'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { computeCustomSessionInsights, type CustomSessionInsights } from '@/lib/session-summary-insights'
import { sessionTotalSets } from '@/lib/custom-session-stats'
import { daysUntilWorkout } from '@/lib/progress-engine'
import { shouldShowLoginCloudPrompt } from '@/lib/summary-actions'
import { shareCustomSessionCard } from '@/lib/share-card'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { enqueueSync } from '@/lib/sync'
import { track } from '@/lib/analytics'
import { trackShareCard } from '@/lib/analytics'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { releaseBodyScrollLock } from '@/hooks/useFocusTrap'

export default function CustomSessionSummary() {
  const { planId } = useParams<{ planId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session')
  const hasSeenLoginCloudPrompt = useAppStore((s) => s.hasSeenLoginCloudPrompt)
  const setHasSeenLoginCloudPrompt = useAppStore((s) => s.setHasSeenLoginCloudPrompt)
  const loginPromptTrackedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<LocalWorkoutSession | null>(null)
  const [previous, setPrevious] = useState<LocalWorkoutSession | undefined>()
  const [plan, setPlan] = useState<CustomPlan | null>(null)
  const [planName, setPlanName] = useState<string | null>(null)
  const [progress, setProgress] = useState<CustomProgramProgress | null>(null)
  const [exerciseMap, setExerciseMap] = useState<Map<string, ExerciseDefinition>>(new Map())
  const [insights, setInsights] = useState<CustomSessionInsights | undefined>()
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [sharing, setSharing] = useState(false)
  const [offerPlanUpdate, setOfferPlanUpdate] = useState(false)
  const [planUpdateBusy, setPlanUpdateBusy] = useState(false)
  const [planUpdateDone, setPlanUpdateDone] = useState(false)

  useEffect(() => {
    releaseBodyScrollLock()
  }, [sessionId])

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
      setInsights(undefined)
      setPrevious(undefined)
      try {
        const s = await db.workoutSessions.get(sessionId)
        if (!s) {
          setSession(null)
          setInsights(undefined)
          return
        }
        setSession(s)
        const resolvedPlanId = s.customPlanId ?? planId
        if (resolvedPlanId) {
          const [plan, prog, exercises, comparison, historicalSessions] = await Promise.all([
            db.customPlans.get(resolvedPlanId),
            db.customProgramProgress.where('customPlanId').equals(resolvedPlanId).first(),
            db.exercises.toArray(),
            getCustomSessionComparison(resolvedPlanId, sessionId),
            db.workoutSessions
              .filter(
                (row) =>
                  isCustomWorkoutSession(row) &&
                  row.status === 'completed' &&
                  row.passed === true,
              )
              .toArray(),
          ])
          setPlanName(plan?.name ?? null)
          setPlan(plan ?? null)
          setProgress(prog ?? null)
          setPrevious(comparison.previous)
          const map = new Map<string, ExerciseDefinition>()
          for (const ex of exercises) map.set(ex.id, ex)
          setExerciseMap(map)
          const sessionDay = parseSessionDayPatchJson(s.sessionDayPatchJson)
          const suggests =
            !!plan &&
            !isPlanUpdateDeclined(s.id) &&
            sessionSuggestsPlanUpdate(plan, s.dayNumber, s.exerciseLogs ?? [], sessionDay)
          setOfferPlanUpdate(suggests)
          setPlanUpdateDone(false)
          setInsights(
            computeCustomSessionInsights({
              current: s,
              previous: comparison.previous,
              exerciseMap: map,
              historicalSessions,
            }),
          )
        } else {
          setPlan(null)
          setOfferPlanUpdate(false)
          setInsights(undefined)
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

  async function handleSavePlanFromSession() {
    if (!session || !plan || planUpdateBusy) return
    setPlanUpdateBusy(true)
    try {
      const sessionDay = parseSessionDayPatchJson(session.sessionDayPatchJson)
      const next = applySessionLogsToPlanDay(
        plan,
        session.dayNumber,
        session.exerciseLogs ?? [],
        exerciseMap,
        sessionDay,
      )
      const saved = await saveCustomPlan(next, { skipValidation: true })
      setPlan(saved)
      const cleared: LocalWorkoutSession = {
        ...session,
        sessionDayPatchJson: null,
      }
      await db.workoutSessions.put(cleared)
      await enqueueSync('workout_sessions', 'update', cleared)
      setSession(cleared)
      setOfferPlanUpdate(false)
      setPlanUpdateDone(true)
      showToast(pl.customSummaryUpdatePlanDone, 'success')
      track('custom_plan_updated_from_session')
    } catch {
      showToast(pl.customSummaryUpdatePlanFailed, 'error')
    } finally {
      setPlanUpdateBusy(false)
    }
  }

  async function handleDiscardPlanUpdate() {
    if (!session) {
      setOfferPlanUpdate(false)
      return
    }
    markPlanUpdateDeclined(session.id)
    const cleared: LocalWorkoutSession = {
      ...session,
      sessionDayPatchJson: null,
    }
    try {
      await db.workoutSessions.put(cleared)
      await enqueueSync('workout_sessions', 'update', cleared)
      setSession(cleared)
    } catch {
      /* local only — decline flag still hides the card */
    }
    setOfferPlanUpdate(false)
    track('custom_plan_update_discarded')
  }

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
  const failed = session.passed === false
  const belowTarget = customSessionHasBelowTarget(session)
  const totalSets = sessionTotalSets(session)
  const exerciseCount = session.exerciseLogs?.length ?? 0
  const cycleComplete =
    !failed &&
    (progress?.status === 'cycle_complete' || !!session.progressionDiffJson)
  const daysLeft = daysUntilWorkout(
    progress?.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const dismissLoginPrompt = () => setHasSeenLoginCloudPrompt(true)
  const sessionDayPatch = parseSessionDayPatchJson(session.sessionDayPatchJson)
  const planChanges =
    plan != null
      ? buildSessionPlanChanges(
          plan,
          session.dayNumber,
          session.exerciseLogs ?? [],
          sessionDayPatch,
        )
      : []
  const planChangeHasSets = planChanges.some((c) => c.kind === 'sets')

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

      {!failed && progress?.nextWorkoutAfter && progress.status === 'rest' && (
        <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
          {pl.nextWorkoutIn(daysLeft)}
        </p>
      )}

      {!failed && !(progress?.nextWorkoutAfter && progress.status === 'rest') && (
        <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{pl.customSummaryRecSuccess}</p>
      )}

      {belowTarget && (
        <p className="mt-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.customSummaryBelowTarget}
        </p>
      )}

      {offerPlanUpdate && planChanges.length > 0 && (
        <Card className="mt-4 border border-[var(--sr-border-subtle)] p-4">
          <p className="font-medium text-[var(--sr-text-primary)]">
            {pl.customSummaryUpdatePlanTitle}
          </p>
          <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.customSummaryUpdatePlanBody}
          </p>
          {planChanges.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 sr-text-body-sm text-[var(--sr-text-primary)]">
              {planChanges.map((change) => {
                const name = exerciseMap.get(change.exerciseId)?.name ?? change.exerciseId
                const key = `${change.kind}-${change.exerciseId}-${change.from}-${change.to}`
                return (
                  <li key={key}>
                    {change.kind === 'sets'
                      ? pl.customSummaryUpdatePlanSets(name, change.from, change.to)
                      : pl.customSummaryUpdatePlanRest(name, change.from, change.to)}
                  </li>
                )
              })}
            </ul>
          )}
          {planChangeHasSets && (
            <p className="mt-2 sr-text-caption text-[var(--sr-text-muted)]">
              {pl.customSummaryUpdatePlanTargetsNote}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button
              size="touch"
              fullWidth
              disabled={planUpdateBusy}
              onClick={() => void handleSavePlanFromSession()}
            >
              {pl.customSummaryUpdatePlanConfirm}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              disabled={planUpdateBusy}
              onClick={() => void handleDiscardPlanUpdate()}
            >
              {pl.customSummaryUpdatePlanDiscard}
            </Button>
          </div>
        </Card>
      )}

      {planUpdateDone && (
        <p className="mt-3 sr-text-body-sm text-[var(--sr-success)]">
          {pl.customSummaryUpdatePlanDone}
        </p>
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
          insights={insights}
        />
      </div>

      <p className="mt-3 text-center sr-text-body-sm text-[var(--sr-text-secondary)]">
        {pl.attemptShort(session.cycleAttempt)}
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {failed && resolvedPlanId ? (
          <Button
            size="touch"
            fullWidth
            onClick={() => navigate(`/workout/custom/${resolvedPlanId}`)}
          >
            {pl.customFailRetryDay}
          </Button>
        ) : resolvedPlanId ? (
          <Button size="touch" fullWidth onClick={() => navigate(`/plans?tab=mine`)}>
            {pl.customSummaryBackToPlan}
          </Button>
        ) : (
          <Button size="touch" fullWidth onClick={() => navigate('/')}>
            {pl.backHome}
          </Button>
        )}
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
                    passed: session.passed !== false,
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
          <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
            {pl.backHome}
          </Button>
        )}
        <Button variant="ghost" fullWidth onClick={() => navigate('/progress?tab=custom&view=history')}>
          {pl.customSummaryViewProgress}
        </Button>
      </div>

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
    </div>
  )
}
