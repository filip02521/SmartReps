import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Dumbbell, Save, Timer, Weight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { TextField } from '@/components/ui/TextField'
import { EmptyState, PageLoader } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import { pl } from '@/i18n/pl'
import { currentLang } from '@/i18n'
import { db, type LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import {
  buildPlanFromFreeWorkout,
  freeWorkoutSetCount,
  freeWorkoutTotalReps,
  freeWorkoutVolumeKg,
  isFreeWorkoutSession,
} from '@/lib/free-workout-service'
import { saveCustomPlan } from '@/lib/custom-plan-service'
import { formatExerciseSetSummary } from '@/lib/custom-exercise-stats'
import { formatSessionElapsed } from '@/lib/session-elapsed'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
import { muscleGroupLabel } from '@/lib/exercise-substitution'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'

/** Summary of a finished ad-hoc workout. The headline action is converting the
 * performed structure into a reusable CustomPlan ("save as scheme"). */
export default function FreeWorkoutSummary() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session')
  const weightUnit = useAppStore((s) => s.settings.weightUnit)

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<LocalWorkoutSession | null>(null)
  const [exercises, setExercises] = useState<Map<string, ExerciseDefinition>>(new Map())
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)
  // Default plan name = "Trening swobodny · <date>" — one tap saves, typing optional.
  const [planName, setPlanName] = useState(
    () =>
      `${pl.freeWorkoutTitle} · ${new Date().toLocaleDateString(
        currentLang() === 'en' ? 'en-US' : 'pl-PL',
        { day: 'numeric', month: 'short' },
      )}`,
  )
  const [saving, setSaving] = useState(false)
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const s = await db.workoutSessions.get(sessionId)
        setSession(s && isFreeWorkoutSession(s) ? s : null)
        const defs = await db.exercises.toArray()
        setExercises(new Map(defs.map((e) => [e.id, e])))
      } finally {
        setLoading(false)
      }
    })()
  }, [sessionId])

  const stats = useMemo(() => {
    if (!session) return null
    const logs = session.exerciseLogs ?? []
    const elapsedSec = Math.max(
      0,
      Math.floor(
        (new Date(session.completedAt ?? session.startedAt).getTime() -
          new Date(session.startedAt).getTime()) /
          1000,
      ),
    )
    return {
      elapsed: formatSessionElapsed(elapsedSec),
      exerciseCount: logs.filter((l) => l.sets.length > 0).length,
      setCount: freeWorkoutSetCount(logs),
      totalReps: freeWorkoutTotalReps(logs),
      volumeDisplay: Math.round(kgToDisplay(freeWorkoutVolumeKg(logs), weightUnit)),
    }
  }, [session, weightUnit])

  async function handleSavePlan() {
    if (!session || saving) return
    const name = planName.trim()
    if (!name) return
    setSaving(true)
    try {
      const plan = buildPlanFromFreeWorkout({ session, exercises, name })
      const saved = await saveCustomPlan(plan)
      setSavedPlanId(saved.id)
      setSaveSheetOpen(false)
      showToast(pl.freePlanSaved, 'success')
    } catch {
      showToast(pl.freePlanSaveFailed, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.loading} />
      </div>
    )
  }

  if (!session || session.status !== 'completed' || !stats) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <EmptyState
          icon={<LogoMark size={48} tone="tonal" />}
          title={pl.sessionSummaryMissingTitle}
          description={pl.missingSessionHint}
          action={{ label: pl.backHome, onClick: () => navigate('/') }}
        />
      </div>
    )
  }

  const logs = (session.exerciseLogs ?? []).filter((l) => l.sets.length > 0)

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top safe-bottom">
      <div className="flex items-center gap-3">
        <CheckCircle2 size={28} className="shrink-0 text-[var(--sr-success)]" aria-hidden />
        <div>
          <h1 className="sr-text-h1 text-[var(--sr-text-primary)]">{pl.freeSummaryTitle}</h1>
          <p className="sr-text-caption text-[var(--sr-text-muted)]">{pl.freeWorkoutTitle}</p>
        </div>
      </div>

      {/* Headline stats */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <Timer size={16} className="mx-auto text-[var(--sr-text-muted)]" aria-hidden />
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--sr-text-primary)]">
            {stats.elapsed}
          </p>
          <p className="sr-text-caption text-[var(--sr-text-muted)]">{pl.freeStatDuration}</p>
        </Card>
        <Card className="p-3 text-center">
          <Dumbbell size={16} className="mx-auto text-[var(--sr-text-muted)]" aria-hidden />
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--sr-text-primary)]">
            {stats.exerciseCount} · {stats.setCount}
          </p>
          <p className="sr-text-caption text-[var(--sr-text-muted)]">
            {pl.freeStatExercisesSets}
          </p>
        </Card>
        <Card className="p-3 text-center">
          <Weight size={16} className="mx-auto text-[var(--sr-text-muted)]" aria-hidden />
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--sr-text-primary)]">
            {stats.volumeDisplay > 0 ? `${stats.volumeDisplay} ${weightUnitLabel(weightUnit)}` : stats.totalReps}
          </p>
          <p className="sr-text-caption text-[var(--sr-text-muted)]">
            {stats.volumeDisplay > 0 ? pl.freeStatVolume : pl.freeStatReps}
          </p>
        </Card>
      </div>

      {/* Exercise recap */}
      <h2 className="mt-6 sr-text-h3 text-[var(--sr-text-primary)]">{pl.freeSummaryExercises}</h2>
      <ul className="mt-2 space-y-2">
        {logs.map((log, idx) => {
          const def = exercises.get(log.exerciseId)
          const metric = def?.primaryMetric ?? 'reps'
          const durationUnit = def?.durationDisplayUnit ?? 'sec'
          return (
            <li
              key={`${log.exerciseId}-${idx}`}
              className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-[var(--sr-text-primary)]">
                  {def?.name ?? pl.exerciseFallbackName}
                </p>
                {def?.muscleGroup && (
                  <p className="sr-text-caption shrink-0 text-[var(--sr-text-muted)]">
                    {muscleGroupLabel(def.muscleGroup)}
                  </p>
                )}
              </div>
              <p className="mt-1 text-sm tabular-nums text-[var(--sr-text-secondary)]">
                {log.sets
                  .map((s) => formatExerciseSetSummary(metric, s, weightUnit, durationUnit))
                  .join('  ·  ')}
              </p>
            </li>
          )
        })}
      </ul>

      {/* Save-as-plan CTA — the performed structure becomes a reusable scheme */}
      {savedPlanId ? (
        <Card className="mt-6 border-[var(--sr-success)] p-4">
          <p className="font-medium text-[var(--sr-text-primary)]">{pl.freePlanSavedTitle}</p>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.freePlanSavedHint}</p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => navigate('/plans?tab=mine')}
            >
              {pl.freeOpenPlan}
            </Button>
            <Button type="button" variant="ghost" className="flex-1" onClick={() => navigate('/')}>
              {pl.done}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mt-6 p-4">
          <p className="font-medium text-[var(--sr-text-primary)]">{pl.freeSavePlanTitle}</p>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.freeSavePlanDesc}</p>
          <Button
            type="button"
            variant="primary"
            size="touch"
            fullWidth
            className="mt-3"
            onClick={() => setSaveSheetOpen(true)}
          >
            <Save size={18} aria-hidden />
            {pl.freeSaveAsPlan}
          </Button>
        </Card>
      )}

      <Button
        type="button"
        variant="ghost"
        fullWidth
        className="mt-4"
        onClick={() => navigate('/')}
      >
        {pl.done}
      </Button>

      <Sheet
        open={saveSheetOpen}
        onClose={() => !saving && setSaveSheetOpen(false)}
        title={pl.freeSavePlanTitle}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.freeSavePlanSheetDesc}</p>
          <TextField
            id="free-plan-name"
            label={pl.freePlanNameLabel}
            placeholder={pl.freePlanNamePlaceholder}
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            size="touch"
            fullWidth
            disabled={saving || planName.trim() === ''}
            onClick={() => void handleSavePlan()}
          >
            {saving ? pl.loading : pl.freeSaveAsPlan}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
