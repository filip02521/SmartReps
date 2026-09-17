import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgramAccentCard } from '@/components/ui/ProgramAccentCard'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { BuiltinWorkoutPreviewSheet } from '@/components/workout/WorkoutPreviewSheet'
import { pl } from '@/i18n/pl'
import {
  getStatusLabel,
  getStatusTone,
  setProgramPaused,
} from '@/lib/program-service'
import { abandonAllInProgress } from '@/lib/session-service'
import { beginLevelChange, beginProgramSetup } from '@/lib/setup-flow'
import { getMaxSetPerDay } from '@/lib/stats-engine'
import { getCycleById } from '@/data/plans'
import { useAppStore } from '@/stores/app-store'
import { ProgramIconBadge } from './program-card/ProgramIconBadge'
import { ProgramCardHeader, type CardBadgeVariant } from './program-card/ProgramCardHeader'
import { ProgramCardProgress, ProgramCardStatsStrip } from './program-card/ProgramCardProgress'
import { ProgramCardPreview, ProgramCardBanner } from './program-card/ProgramCardPreview'
import { ProgramCardCta } from './program-card/ProgramCardCta'
import { StaleRestSheet, CycleMapSheet } from './program-card/ProgramCardSheets'
import type { ProgramCardModel, TipSuppression } from '@/lib/home-summary'

function toneToBadge(
  tone: ReturnType<typeof getStatusTone>,
): CardBadgeVariant {
  if (tone === 'success') return 'success'
  if (tone === 'warning') return 'warning'
  if (tone === 'error') return 'error'
  return 'info'
}

export function ProgramHomeCard({
  model,
  tipSuppression,
  allResting,
  onReload,
}: {
  model: ProgramCardModel
  tipSuppression: TipSuppression
  allResting?: boolean
  onReload: () => void
}) {
  const navigate = useNavigate()
  const enabledPrograms = useAppStore((s) => s.settings.enabledPrograms)
  const [trainDespiteRest, setTrainDespiteRest] = useState(false)
  const [showStaleConfirm, setShowStaleConfirm] = useState(false)
  const [showTrainAnywayConfirm, setShowTrainAnywayConfirm] = useState(false)
  const [showStaleRestSheet, setShowStaleRestSheet] = useState(false)
  const [pendingSetup, setPendingSetup] = useState<'level' | 'retest' | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showCycleMap, setShowCycleMap] = useState(false)
  const [cycleMapDay, setCycleMapDay] = useState<number | null>(null)
  const [maxPerDay, setMaxPerDay] = useState<{ day: number; maxActual: number }[]>([])

  const { program, bucket, progress, stats, resume, available, daysLeft } = model
  const isPaused = progress?.status === 'paused'
  const isTestPending = progress?.status === 'test_pending'
  const resting = bucket === 'resting' || (resume != null && !available && !isPaused && !isTestPending)
  const hasResume = bucket === 'resume' || bucket === 'resume_stale'
  const hideRestPreview = Boolean(allResting && resting && !hasResume)
  // Rest preview box already shows nextWorkoutLabel as its primary line —
  // the stats strip "Następny trening" entry would repeat the same datum.
  const restPreviewShown =
    (bucket === 'resting' || bucket === 'test_pending_rest') && !hideRestPreview
  const cycle = progress ? getCycleById(progress.cycleId) : null

  // When opening the cycle map, default to the current day (or day 1)
  // to avoid the anti-pattern of showing an empty details area.
  const openCycleMap = async () => {
    if (progress) {
      setMaxPerDay(await getMaxSetPerDay(program, progress.cycleId, progress.cycleAttempt))
    }
    setCycleMapDay(progress?.currentDay ?? 1)
    setShowCycleMap(true)
  }

  const displayBadge = hasResume
    ? { label: pl.statusInProgress, variant: 'info' as const }
    : progress
      ? { label: getStatusLabel(progress), variant: toneToBadge(getStatusTone(progress)) }
      : { label: pl.notConfigured, variant: 'info' as const }

  async function abandonThenForce() {
    setBusy(true)
    try {
      await abandonAllInProgress(program)
      navigate(`/workout/${program}?force=1`)
    } finally {
      setBusy(false)
    }
  }

  async function abandonAndReload() {
    setBusy(true)
    try {
      await abandonAllInProgress(program)
      onReload()
    } finally {
      setBusy(false)
    }
  }

  function startDay() {
    if (!model.currentDaySets || !cycle) {
      // Fallback: no preview data — start directly.
      navigate(
        trainDespiteRest || !available
          ? `/workout/${program}?force=1`
          : `/workout/${program}`,
      )
      return
    }
    setShowPreview(true)
  }

  if (model.loadError) {
    // Never hide the card — a failed load must stay visible with a retry,
    // otherwise an active program silently disappears from the dashboard.
    return (
      <ProgramAccentCard program={program} id={`program-${program}`} className="scroll-mt-24">
        <div className="flex items-center gap-2.5">
          <ProgramIconBadge program={program} />
          <h3 className="min-w-0 flex-1 break-words sr-text-h3 text-[var(--sr-text-primary)]">
            {model.label}
          </h3>
        </div>
        <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">{model.loadError}</p>
        <Button className="mt-3" size="touch" fullWidth onClick={onReload}>
          {pl.retry}
        </Button>
      </ProgramAccentCard>
    )
  }

  if (bucket === 'unconfigured' || !progress) {
    return (
      <ProgramAccentCard program={program} id={`program-${program}`} className="scroll-mt-24">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <ProgramIconBadge program={program} />
            <div className="min-w-0 flex-1">
              <h3 className="min-w-0 break-words sr-text-h3 text-[var(--sr-text-primary)]">
                {model.label}
              </h3>
            </div>
          </div>
          <Badge variant="info" size="sm">
            {pl.notConfigured}
          </Badge>
        </div>
        <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.notConfiguredHint}</p>
        <Button
          className="mt-3"
          size="touch"
          fullWidth
          onClick={() => navigate(`/setup/test/${program}`)}
        >
          {pl.startSetup}
        </Button>
      </ProgramAccentCard>
    )
  }

  const showCrossTrain =
    program === 'pullups' &&
    bucket === 'resting' &&
    !allResting &&
    enabledPrograms.includes('pushups')

  return (
    <ProgramAccentCard program={program} id={`program-${program}`} className="scroll-mt-24">
      <ProgramCardHeader
        program={program}
        label={model.label}
        badge={displayBadge}
        progress={progress}
        resume={resume}
        showSkipRest={bucket === 'resting' && !hasResume}
        onReload={onReload}
        onPendingSetup={setPendingSetup}
        onOpenCycleMap={openCycleMap}
      />

      {cycle && (
        <ProgramCardProgress
          program={program}
          cycle={cycle}
          progress={progress}
          isTestPending={isTestPending}
          cycleNameShort={model.cycleNameShort}
        />
      )}

      <ProgramCardPreview
        bucket={bucket}
        hasResume={hasResume}
        resume={resume}
        stats={stats}
        daysLeft={daysLeft}
        hideRestPreview={hideRestPreview}
        currentDaySets={model.currentDaySets}
        setsTargetTotal={model.setsTargetTotal}
      />

      {stats && (
        <ProgramCardStatsStrip stats={stats} showNextWorkout={!restPreviewShown} />
      )}

      <ProgramCardBanner
        hasResume={hasResume}
        resumeStale={resume?.stale ?? false}
        resting={resting}
        isTestPending={isTestPending}
        bucket={bucket}
        trainDespiteRest={trainDespiteRest}
        hideRestPreview={hideRestPreview}
        cycleAttempt={progress.cycleAttempt}
        lastFailed={model.lastFailed}
        tipSuppression={tipSuppression}
        onChangeLevel={() => void beginLevelChange(navigate, program)}
      />

      <ProgramCardCta
        bucket={bucket}
        hasResume={hasResume}
        resume={resume}
        resting={resting}
        trainDespiteRest={trainDespiteRest}
        showCrossTrain={showCrossTrain}
        busy={busy}
        currentDay={progress.currentDay}
        handlers={{
          // Stale session data must always be confirmed before resuming —
          // resting adds a rest-specific sheet (both abandon-only paths),
          // otherwise the simpler continue/start-fresh confirm sheet.
          onResume: () => {
            if (!resume) return
            if (resume.stale) {
              if (resting) setShowStaleRestSheet(true)
              else setShowStaleConfirm(true)
            } else {
              navigate(`/workout/${program}?force=1`)
            }
          },
          onStartFresh: () => void abandonAndReload(),
          onTrainAnywayIntent: () => setShowTrainAnywayConfirm(true),
          onResumeProgram: () => {
            void (async () => {
              await setProgramPaused(program, false)
              onReload()
            })()
          },
          onRetestNow: () => void beginProgramSetup(navigate, program, { retest: true }),
          onChangeLevel: () => void beginLevelChange(navigate, program),
          onTrainDespiteRest: () => setTrainDespiteRest(true),
          onCancelDespiteRest: () => setTrainDespiteRest(false),
          onStartDay: startDay,
          onCrossTrain: () => {
            document
              .getElementById('program-pushups')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          },
        }}
      />

      {showStaleConfirm && resume && (
        <ConfirmSheet
          title={pl.staleSessionTitle}
          message={pl.staleSessionConfirm}
          confirmLabel={pl.continueSession}
          cancelLabel={pl.startFresh}
          onConfirm={() => {
            setShowStaleConfirm(false)
            navigate(`/workout/${program}?force=1`)
          }}
          onCancel={async () => {
            await abandonAllInProgress(program)
            setShowStaleConfirm(false)
            onReload()
          }}
        />
      )}

      {showTrainAnywayConfirm && (
        <ConfirmSheet
          title={pl.abandonResumeTrainAnywayTitle}
          message={pl.abandonResumeTrainAnywayBody}
          confirmLabel={pl.abandonAndTrain}
          cancelLabel={pl.cancel}
          variant="danger"
          onConfirm={() => {
            setShowTrainAnywayConfirm(false)
            void abandonThenForce()
          }}
          onCancel={() => setShowTrainAnywayConfirm(false)}
        />
      )}

      {showStaleRestSheet && (
        <StaleRestSheet
          busy={busy}
          onAbandon={() => {
            void (async () => {
              await abandonAndReload()
              setShowStaleRestSheet(false)
            })()
          }}
          onAbandonAndTrain={() => {
            setShowStaleRestSheet(false)
            void abandonThenForce()
          }}
          onClose={() => setShowStaleRestSheet(false)}
        />
      )}

      {pendingSetup && (
        <ConfirmSheet
          title={pendingSetup === 'retest' ? pl.menuRetest : pl.menuChangeLevel}
          message={pl.changeLevelActiveWarning}
          confirmLabel={pl.confirm}
          variant="danger"
          onConfirm={() => {
            const mode = pendingSetup
            setPendingSetup(null)
            if (mode === 'retest') {
              void beginProgramSetup(navigate, program, { retest: true })
            } else {
              void beginLevelChange(navigate, program)
            }
          }}
          onCancel={() => setPendingSetup(null)}
        />
      )}

      {showPreview && cycle && progress && model.currentDaySets && (
        <BuiltinWorkoutPreviewSheet
          open
          onClose={() => setShowPreview(false)}
          programLabel={model.label}
          dayNumber={progress.currentDay}
          cycleName={model.cycleNameShort}
          sets={model.currentDaySets}
          restBetweenSetsSec={
            cycle.days.find((d) => d.dayNumber === progress.currentDay)?.restBetweenSetsSec ?? 90
          }
          onStart={() => {
            setShowPreview(false)
            navigate(
              trainDespiteRest || !available
                ? `/workout/${program}?force=1`
                : `/workout/${program}`,
            )
          }}
        />
      )}

      {showCycleMap && cycle && progress && (
        <CycleMapSheet
          cycle={cycle}
          progress={progress}
          stats={stats}
          maxPerDay={maxPerDay}
          selectedDay={cycleMapDay}
          onSelectDay={setCycleMapDay}
          onShowFullPlan={() => {
            setShowCycleMap(false)
            setCycleMapDay(null)
            navigate(`/plans?tab=programs&highlight=${progress.cycleId}`)
          }}
          onClose={() => {
            setShowCycleMap(false)
            setCycleMapDay(null)
          }}
        />
      )}
    </ProgramAccentCard>
  )
}
