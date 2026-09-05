import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Trophy, PencilLine } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  applySessionLogsToPlanDaySelective,
  buildSessionPlanChanges,
  categorizePlanChanges,
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
import { useAchievementUiStore } from '@/stores/achievement-ui-store'
import { AchievementSummaryList } from '@/components/achievements/AchievementSummaryList'
import { SessionNoteCard } from '@/components/workout/SessionNoteCard'
import { AiInsightCard } from '@/components/brand/AiInsightCard'
import { generatePostWorkoutInsight } from '@/lib/ai/proactive-coach'
import type { LocalAiInsight } from '@/lib/db'

export default function CustomSessionSummary() {
  const { planId } = useParams<{ planId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session')
  const hasSeenLoginCloudPrompt = useAppStore((s) => s.hasSeenLoginCloudPrompt)
  const setHasSeenLoginCloudPrompt = useAppStore((s) => s.setHasSeenLoginCloudPrompt)
  const weightUnit = useAppStore((s) => s.settings.weightUnit)
  const loginPromptTrackedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<LocalWorkoutSession | null>(null)
  const [previous, setPrevious] = useState<LocalWorkoutSession | undefined>()
  const [plan, setPlan] = useState<CustomPlan | null>(null)
  const [planName, setPlanName] = useState<string | null>(null)
  const [progress, setProgress] = useState<CustomProgramProgress | null>(null)
  const [exerciseMap, setExerciseMap] = useState<Map<string, ExerciseDefinition>>(new Map())
  const [insights, setInsights] = useState<CustomSessionInsights | undefined>()
  const [coachInsight, setCoachInsight] = useState<LocalAiInsight | null>(null)
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [sharing, setSharing] = useState(false)
  const [offerPlanUpdate, setOfferPlanUpdate] = useState(false)
  const [planUpdateBusy, setPlanUpdateBusy] = useState(false)
  const [planUpdateDone, setPlanUpdateDone] = useState(false)
  const [applyValues, setApplyValues] = useState(true)
  const [applyExercises, setApplyExercises] = useState(false)
  const [newAchievements, setNewAchievements] = useState<
    import('@/lib/achievements/types').LocalAchievementUnlock[]
  >([])
  const achievementQueue = useAchievementUiStore((s) => s.queue)
  const clearQueue = useAchievementUiStore((s) => s.clearQueue)
  const setSummaryMode = useAchievementUiStore((s) => s.setSummaryMode)

  // Summary page owns the achievement queue — suppress AchievementHost popups
  useEffect(() => {
    setSummaryMode(true)
    return () => setSummaryMode(false)
  }, [setSummaryMode])

  // Subscribe to queue changes — handles race condition where evaluation
  // completes after summary mount. Drain queue into local state when items arrive.
  useEffect(() => {
    if (achievementQueue.length === 0) return
    setNewAchievements((prev) => {
      const existingIds = new Set(prev.map((r) => r.id))
      const fresh = achievementQueue.filter((r) => !existingIds.has(r.id))
      return fresh.length > 0 ? [...prev, ...fresh] : prev
    })
    clearQueue()
  }, [achievementQueue, clearQueue])

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
            sessionSuggestsPlanUpdate(plan, s.dayNumber, s.exerciseLogs ?? [], sessionDay, map)
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
          // Proactive coach: load or generate post-workout insight
          void loadOrGenerateCoachInsight(s, comparison.previous, historicalSessions, exercises)
        } else {
          setPlan(null)
          setOfferPlanUpdate(false)
          setInsights(undefined)
        }
      } finally {
        setLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when summary identity changes
  }, [sessionId, planId])

  async function loadOrGenerateCoachInsight(
    current: LocalWorkoutSession,
    previousSession: LocalWorkoutSession | undefined,
    historicalSessions: LocalWorkoutSession[],
    exercises: ExerciseDefinition[],
  ) {
    const existing = await db.aiInsights.where('sessionId').equals(current.id).first()
    if (existing && !existing.dismissedAt) {
      setCoachInsight(existing)
      return
    }
    if (existing?.dismissedAt) return

    const settings = useAppStore.getState().settings
    const aiConfig = settings.aiProactiveCoach && settings.aiApiKey
      ? { apiKey: settings.aiApiKey, model: settings.aiModel ?? 'gpt-4o-mini', baseURL: settings.aiBaseUrl || undefined }
      : undefined

    try {
      const insight = await generatePostWorkoutInsight({
        session: current,
        previous: previousSession,
        historicalSessions,
        exercises,
        aiConfig,
      })
      // Guard against stale state if user navigated away during async generation
      if (current.id !== session?.id) return
      await db.aiInsights.put(insight)
      void enqueueSync('ai_insights', 'insert', insight)
      setCoachInsight(insight)
    } catch {
      // Non-blocking
    }
  }

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

  async function handleSavePlanFromSession(opts?: { values?: boolean; exercises?: boolean }) {
    if (!session || !plan || planUpdateBusy) return
    const values = opts?.values ?? applyValues
    const exercises = opts?.exercises ?? applyExercises
    if (!values && !exercises) return
    setPlanUpdateBusy(true)
    try {
      const sessionDay = parseSessionDayPatchJson(session.sessionDayPatchJson)
      const next = applySessionLogsToPlanDaySelective(
        plan,
        session.dayNumber,
        session.exerciseLogs ?? [],
        exerciseMap,
        sessionDay,
        { applyValues: values, applyExercises: exercises },
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
          exerciseMap,
        )
      : []
  const planChangeHasSets = planChanges.some((c) => c.kind === 'sets' || c.kind === 'target_values')
  const { hasValueChanges, hasExerciseChanges } = categorizePlanChanges(planChanges)
  const canSaveSelected = applyValues || applyExercises

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

      {/* Hero status banner */}
      <div
        className={cn(
          'mb-6 flex items-center gap-3 rounded-[var(--sr-radius-lg)] border p-4',
          failed
            ? 'border-[var(--sr-error)]/30 bg-[var(--sr-error-muted)]'
            : 'border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)]',
        )}
      >
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
            failed
              ? 'bg-[var(--sr-error)]/15 text-[var(--sr-error)]'
              : 'bg-[var(--sr-success)]/15 text-[var(--sr-success)]',
          )}
          aria-hidden
        >
          {failed ? <XCircle size={24} strokeWidth={2.25} /> : <CheckCircle2 size={24} strokeWidth={2.25} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--sr-text-primary)]">
            {failed ? pl.summaryHeroFail : pl.summaryHeroSuccess}
          </p>
          <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {planName ?? pl.dayLabel(session.dayNumber)}
            {` · ${pl.attemptShort(session.cycleAttempt)}`}
          </p>
        </div>
      </div>

      {/* Proactive coach insight */}
      {coachInsight && (
        <AiInsightCard
          insight={coachInsight}
          className="mb-6"
          onDismiss={async () => {
            const dismissed = { ...coachInsight, dismissedAt: new Date().toISOString() }
            await db.aiInsights.put(dismissed)
            void enqueueSync('ai_insights', 'update', dismissed)
            setCoachInsight(null)
            showToast(pl.coachPostWorkoutDismissed, 'info')
          }}
        />
      )}

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
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]" aria-hidden>
              <PencilLine size={18} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--sr-text-primary)]">
                {pl.customSummaryUpdatePlanTitle}
              </p>
              <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.customSummaryUpdatePlanBody}
              </p>
            </div>
          </div>
          {planChanges.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 sr-text-body-sm text-[var(--sr-text-primary)]">
              {planChanges.map((change, idx) => {
                if (change.kind === 'exercise_swap') {
                  const fromName = exerciseMap.get(change.fromExerciseId)?.name ?? change.fromExerciseId
                  const toName = exerciseMap.get(change.toExerciseId)?.name ?? change.toExerciseId
                  return (
                    <li key={`swap-${change.fromExerciseId}-${change.toExerciseId}-${idx}`}>
                      {pl.customSummaryUpdatePlanSwap(fromName, toName)}
                    </li>
                  )
                }
                if (change.kind === 'exercise_added') {
                  const name = exerciseMap.get(change.exerciseId)?.name ?? change.exerciseId
                  return (
                    <li key={`added-${change.exerciseId}-${idx}`}>
                      {pl.customSummaryUpdatePlanAdded(name)}
                    </li>
                  )
                }
                if (change.kind === 'target_values') {
                  const name = exerciseMap.get(change.exerciseId)?.name ?? change.exerciseId
                  const summary = change.changes.map((c) => {
                    const segments: string[] = []
                    if (c.fromReps != null && c.toReps != null) {
                      segments.push(pl.customSummaryValueReps(c.fromReps, c.toReps))
                    }
                    if (c.fromWeightKg != null && c.toWeightKg != null) {
                      segments.push(pl.customSummaryValueWeight(c.fromWeightKg, c.toWeightKg))
                    }
                    if (c.fromDurationSec != null && c.toDurationSec != null) {
                      segments.push(pl.customSummaryValueDuration(c.fromDurationSec, c.toDurationSec))
                    }
                    return pl.customSummaryValueSet(c.setNumber, segments.join(', '))
                  }).join(' · ')
                  return (
                    <li key={`target-${change.exerciseId}-${idx}`}>
                      {pl.customSummaryUpdatePlanValues(name, summary)}
                    </li>
                  )
                }
                const name = exerciseMap.get(change.exerciseId)?.name ?? change.exerciseId
                const key = `${change.kind}-${change.exerciseId}-${change.from}-${change.to}-${idx}`
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

          {/* Selective update checkboxes */}
          <div className="mt-4 flex flex-col gap-3">
            {hasValueChanges && (
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={applyValues}
                  onChange={(e) => setApplyValues(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-[var(--sr-border-strong)] bg-[var(--sr-bg-surface)] text-[var(--sr-brand-primary)] focus:ring-[var(--sr-brand-primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--sr-text-primary)]">
                    {pl.customSummaryUpdatePlanGroupValues}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">
                    {pl.customSummaryUpdatePlanGroupValuesHint}
                  </span>
                </span>
              </label>
            )}
            {hasExerciseChanges && (
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={applyExercises}
                  onChange={(e) => setApplyExercises(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-[var(--sr-border-strong)] bg-[var(--sr-bg-surface)] text-[var(--sr-brand-primary)] focus:ring-[var(--sr-brand-primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--sr-text-primary)]">
                    {pl.customSummaryUpdatePlanGroupExercises}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">
                    {pl.customSummaryUpdatePlanGroupExercisesHint}
                  </span>
                </span>
              </label>
            )}
          </div>

          {planChangeHasSets && applyValues && (
            <p className="mt-2 sr-text-caption text-[var(--sr-text-muted)]">
              {pl.customSummaryUpdatePlanTargetsNote}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {hasValueChanges && hasExerciseChanges && (
              <Button
                size="touch"
                fullWidth
                disabled={planUpdateBusy || !canSaveSelected}
                onClick={() => void handleSavePlanFromSession()}
              >
                {pl.customSummaryUpdatePlanSaveSelected}
              </Button>
            )}
            <Button
              size="touch"
              fullWidth
              variant={hasValueChanges && hasExerciseChanges ? 'secondary' : 'primary'}
              disabled={planUpdateBusy}
              onClick={() => void handleSavePlanFromSession({ values: true, exercises: true })}
            >
              {pl.customSummaryUpdatePlanSaveAll}
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
        <div className="mt-3 flex items-center gap-2.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)] px-4 py-3">
          <CheckCircle2 size={18} className="shrink-0 text-[var(--sr-success)]" aria-hidden />
          <p className="sr-text-body-sm text-[var(--sr-text-primary)]">
            {pl.customSummaryUpdatePlanDone}
          </p>
        </div>
      )}

      {cycleComplete && (
        <div className="mt-3 flex items-center gap-2.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)] px-4 py-3">
          <Trophy size={18} className="shrink-0 text-[var(--sr-success)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--sr-text-primary)]">{pl.cycleComplete}</p>
        </div>
      )}

      {session.progressionDiffJson && resolvedPlanId && (
        <CustomProgressionDiffList
          diffJson={session.progressionDiffJson}
          planId={resolvedPlanId}
        />
      )}

      <div className="mt-6">
        <h2 className="mb-3 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
          {pl.summarySectionStats}
        </h2>
        <CustomSessionRecap
          current={session}
          previous={previous}
          exerciseMap={exerciseMap}
          insights={insights}
          weightUnit={weightUnit}
        />
      </div>

      {session?.id && (
        <div className="mt-6">
          <h2 className="mb-3 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
            {pl.summarySectionNotes}
          </h2>
          <SessionNoteCard sessionId={session.id} />
        </div>
      )}

      {newAchievements.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
            {pl.summarySectionAchievements}
          </h2>
          <AchievementSummaryList unlocks={newAchievements} />
        </div>
      )}

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

      {/* Action buttons — at the bottom */}
      <div className="mt-8 flex flex-col gap-2">
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
    </div>
  )
}
