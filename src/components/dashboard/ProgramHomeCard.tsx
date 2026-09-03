import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import { ProgramAccentCard } from '@/components/ui/ProgramAccentCard'
import { ProgramIcon } from '@/components/ui/ProgramIcon'
import { NestedStat } from '@/components/ui/NestedStat'
import { CycleDayRail } from '@/components/ui/CycleDayRail'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { BuiltinWorkoutPreviewSheet } from '@/components/workout/WorkoutPreviewSheet'
import { ErrorBanner, FeedbackBanner } from '@/components/ux/Feedback'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'
import {
  getStatusLabel,
  getStatusTone,
  setProgramPaused,
} from '@/lib/program-service'
import { abandonAllInProgress } from '@/lib/session-service'
import { beginLevelChange, beginProgramSetup } from '@/lib/setup-flow'
import { getCycleDayStatus } from '@/lib/cycle-progress'
import { getCycleById } from '@/data/plans'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import type { ProgramCardModel, TipSuppression } from '@/lib/home-summary'

function toneToBadge(
  tone: ReturnType<typeof getStatusTone>,
): 'success' | 'warning' | 'error' | 'info' {
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
  const [showMenu, setShowMenu] = useState(false)
  const [trainDespiteRest, setTrainDespiteRest] = useState(false)
  const [showStaleConfirm, setShowStaleConfirm] = useState(false)
  const [showTrainAnywayConfirm, setShowTrainAnywayConfirm] = useState(false)
  const [showStaleRestSheet, setShowStaleRestSheet] = useState(false)
  const [pendingSetup, setPendingSetup] = useState<'level' | 'retest' | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { program, bucket, progress, stats, resume, available, daysLeft } = model
  const isPaused = progress?.status === 'paused'
  const isTestPending = progress?.status === 'test_pending'
  const resting = bucket === 'resting' || (resume != null && !available && !isPaused && !isTestPending)
  const hasResume = bucket === 'resume' || bucket === 'resume_stale'
  const hideRestPreview = Boolean(allResting && resting && !hasResume)
  const cycle = progress ? getCycleById(progress.cycleId) : null
  const waitingRestDays = Math.max(1, daysLeft)

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

  if (model.loadError) {
    return (
      <ProgramAccentCard program={program}>
        <p className="mb-3 font-semibold text-[var(--sr-text-primary)]">{model.label}</p>
        <ErrorBanner message={model.loadError} onRetry={onReload} />
      </ProgramAccentCard>
    )
  }

  if (bucket === 'unconfigured' || !progress) {
    return (
      <ProgramAccentCard program={program} id={`program-${program}`} className="scroll-mt-24">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]"
              style={{
                background: program === 'pushups'
                  ? 'color-mix(in srgb, var(--sr-pushups-accent) 15%, transparent)'
                  : 'color-mix(in srgb, var(--sr-pullups-accent) 15%, transparent)',
              }}
              aria-hidden
            >
              <ProgramIcon program={program} size={22} />
            </div>
            <p className="font-semibold text-[var(--sr-text-primary)]">{model.label}</p>
          </div>
          <Badge variant="info">{pl.notConfigured}</Badge>
        </div>
        <p className="mt-3 text-sm text-[var(--sr-text-secondary)]">{pl.notConfiguredHint}</p>
        <Button
          className="mt-5"
          size="touch"
          fullWidth
          onClick={() => navigate(`/setup/test/${program}`)}
        >
          {pl.startSetup}
        </Button>
      </ProgramAccentCard>
    )
  }

  const completedDays =
    isTestPending && cycle
      ? cycle.days.length
      : Math.max(0, progress.currentDay - 1)
  const pct =
    cycle && cycle.days.length > 0
      ? Math.round((completedDays / cycle.days.length) * 100)
      : 0

  return (
    <ProgramAccentCard program={program} id={`program-${program}`} className="scroll-mt-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]"
            style={{
              background: program === 'pushups'
                ? 'color-mix(in srgb, var(--sr-pushups-accent) 15%, transparent)'
                : 'color-mix(in srgb, var(--sr-pullups-accent) 15%, transparent)',
            }}
            aria-hidden
          >
            <ProgramIcon program={program} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="sr-text-h2 text-[var(--sr-text-primary)]" title={model.label}>
              {model.label}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={displayBadge.variant}>{displayBadge.label}</Badge>
              {model.cycleNameShort && (
                <span className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                  {model.cycleNameShort}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label={pl.menuProgram}
          aria-haspopup="dialog"
          aria-expanded={showMenu}
          className={cn(
            'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
            FOCUS_RING,
          )}
          onClick={() => setShowMenu(true)}
        >
          <MoreVertical size={20} />
        </button>
      </div>

      <Sheet open={showMenu} onClose={() => setShowMenu(false)} title={pl.menuProgram}>
        <div className="flex flex-col gap-1 pb-2">
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              if (resume) setPendingSetup('level')
              else void beginLevelChange(navigate, program)
            }}
          >
            {pl.menuChangeLevel}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              if (progress) {
                navigate(`/plans?tab=programs&highlight=${progress.cycleId}`)
              } else {
                navigate('/plans?tab=programs')
              }
            }}
          >
            {pl.menuFullCycle}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              navigate('/progress?tab=history')
            }}
          >
            {pl.menuHistory}
          </Button>
          {bucket === 'resting' && !hasResume && (
            <Button
              variant="ghost"
              fullWidth
              className="justify-start px-3"
              onClick={() => {
                setShowMenu(false)
                void (async () => {
                  const { skipRestDay } = await import('@/lib/program-service')
                  await skipRestDay(program)
                  onReload()
                  showToast(pl.restDaySkipped, 'success')
                })()
              }}
            >
              {pl.menuSkipRest}
            </Button>
          )}
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
            onClick={() => {
              setShowMenu(false)
              if (resume) setPendingSetup('retest')
              else void beginProgramSetup(navigate, program, { retest: true })
            }}
          >
            {pl.menuRetest}
          </Button>
        </div>
      </Sheet>

      {cycle && (
        <div className="mt-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
              {isTestPending
                ? pl.cycleDoneTestLabel
                : pl.homeProgramLevelDay(
                    model.cycleNameShort ?? '',
                    progress.currentDay,
                    cycle.days.length,
                  )}
              {progress.cycleAttempt >= 2 && (
                <>
                  {' · '}
                  {pl.homeCycleRestart(progress.cycleAttempt)}
                </>
              )}
            </p>
            <p className="sr-text-body-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
              {pct}%
            </p>
          </div>

          {/* Progress bar */}
          <div
            className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--sr-bg-surface)]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{
                width: `${pct}%`,
                background: program === 'pushups'
                  ? 'var(--sr-pushups-accent)'
                  : 'var(--sr-pullups-accent)',
              }}
            />
          </div>

          <CycleDayRail
            totalDays={cycle.days.length}
            days={cycle.days.map((d) => ({
              dayNumber: d.dayNumber,
              status: getCycleDayStatus(progress, d.dayNumber, cycle.days.length),
            }))}
          />
          {!isTestPending &&
            cycle.days.some(
              (d) => getCycleDayStatus(progress, d.dayNumber, cycle.days.length) === 'current',
            ) && (
              <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.homeNowDay(progress.currentDay)}
              </p>
            )}
        </div>
      )}

      {/* Session preview */}
      {(() => {
        if (hasResume && resume) {
          return (
            <NestedStat
              className="mt-4"
              size="md"
              overline={pl.statusInProgress}
              value={pl.homeInProgressSets(resume.set, resume.total, resume.day)}
            >
              <div className="mt-3 flex gap-1.5" aria-hidden>
                {Array.from({ length: resume.total }, (_, i) => (
                  <span
                    key={i}
                    className="h-2.5 flex-1 rounded-full"
                    style={{
                      background:
                        i < resume.currentSetIndex
                          ? 'var(--sr-success)'
                          : i === resume.currentSetIndex
                            ? 'var(--sr-brand-primary)'
                            : 'var(--sr-bg-elevated)',
                    }}
                  />
                ))}
              </div>
            </NestedStat>
          )
        }
        if (bucket === 'paused') {
          return (
            <NestedStat className="mt-4" size="md" value={pl.homeProgramPaused} />
          )
        }
        if (bucket === 'test_pending_ready') return null
        if (bucket === 'resting' || bucket === 'test_pending_rest') {
          if (hideRestPreview) return null
          return (
            <NestedStat
              className="mt-4"
              size="md"
              value={pl.restPrimaryLabel(stats?.nextWorkoutLabel ?? pl.restIn(daysLeft))}
              hint={
                bucket === 'resting'
                  ? pl.restGateHint(waitingRestDays)
                  : pl.homeCardTestRestHint(stats?.nextWorkoutLabel ?? pl.today)
              }
            />
          )
        }
        if (bucket === 'ready' && model.currentDaySets && model.setsTargetTotal != null) {
          return (
            <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3.5 py-3">
              <div className="mb-2.5 flex items-baseline justify-between gap-2">
                <p className="sr-text-overline text-[var(--sr-text-muted)]">{pl.homeTodaySession}</p>
                <p className="sr-text-body-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
                  {pl.plansDayReps(model.currentDaySets.length, model.setsTargetTotal)}
                </p>
              </div>
              <SetTargetsRow sets={model.currentDaySets} size="md" />
            </div>
          )
        }
        return null
      })()}

      {stats &&
        (stats.lastSession ||
          stats.lastTotalReps !== null ||
          stats.maxLastSetTrend.delta !== null) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {stats.lastSession && (
            <NestedStat
              size="md"
              overline={pl.lastWorkout}
              value={pl.dayDoneCheck(stats.lastSession.dayNumber)}
            />
          )}
          <NestedStat
            size="md"
            className={!stats.lastSession ? 'col-span-2' : undefined}
            overline={pl.nextWorkout}
            value={stats.nextWorkoutLabel}
          />
          {(stats.lastTotalReps !== null || stats.maxLastSetTrend.delta !== null) && (
            <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3.5 py-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
              {stats.lastTotalReps !== null && (
                <span>
                  {pl.totalRepsLastSession(stats.lastTotalReps)}
                </span>
              )}
              {stats.maxLastSetTrend.delta !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <span>{pl.maxSetTrend}</span>
                  <span className="font-semibold tabular-nums text-[var(--sr-text-primary)]">
                    {stats.maxLastSetTrend.current}
                  </span>
                  <TrendIndicator delta={stats.maxLastSetTrend.delta} />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Local banners with tip exclusivity */}
      {(() => {
        if (hasResume && resume?.stale && !tipSuppression.stale) {
          return (
            <div className="mt-4">
              <FeedbackBanner variant="warning" message={pl.staleSession} />
            </div>
          )
        }
        if (isTestPending && !tipSuppression.test) {
          return (
            <div className="mt-4">
              <FeedbackBanner variant="info" message={pl.cycleCompleteHint} />
            </div>
          )
        }
        if (hasResume && resting && !tipSuppression.stale) {
          return (
            <div className="mt-4">
              <FeedbackBanner variant="info" message={pl.resumeDespiteRestHint} />
            </div>
          )
        }
        if (
          !hasResume &&
          bucket === 'resting' &&
          !trainDespiteRest &&
          !hideRestPreview &&
          progress.cycleAttempt >= 2 &&
          model.lastFailed &&
          !tipSuppression.level
        ) {
          // Preview already shows rest timing; banner only for level nudge.
          return (
            <div className="mt-4">
              <FeedbackBanner
                variant="info"
                message={pl.considerLowerLevel}
                actionLabel={pl.menuChangeLevel}
                onAction={() => void beginLevelChange(navigate, program)}
              />
            </div>
          )
        }
        if (
          progress.cycleAttempt >= 2 &&
          !hasResume &&
          bucket === 'ready' &&
          !tipSuppression.level &&
          model.lastFailed
        ) {
          return (
            <div className="mt-4">
              <FeedbackBanner
                variant="info"
                message={pl.considerLowerLevel}
                actionLabel={pl.menuChangeLevel}
                onAction={() => void beginLevelChange(navigate, program)}
              />
            </div>
          )
        }
        return null
      })()}

      {/* CTA */}
      <div className="mt-5 border-t border-[var(--sr-border-subtle)] pt-5">
        {hasResume && resume && (
          <div className="flex flex-col gap-2">
            <Button
              size="touch"
              fullWidth
              disabled={busy}
              onClick={() => {
                if (resume.stale && !resting) setShowStaleConfirm(true)
                else navigate(`/workout/${program}?force=1`)
              }}
            >
              {pl.continueWorkout(resume.day, resume.set, resume.total)}
            </Button>
            {resume.stale && !resting && (
              <Button
                variant="ghost"
                fullWidth
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await abandonAllInProgress(program)
                    onReload()
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {pl.startFresh}
              </Button>
            )}
            {!resume.stale && resting && (
              <Button
                variant="ghost"
                fullWidth
                disabled={busy}
                onClick={() => setShowTrainAnywayConfirm(true)}
              >
                {pl.trainAnywayNew}
              </Button>
            )}
            {resume.stale && resting && (
              <Button
                variant="ghost"
                fullWidth
                disabled={busy}
                onClick={() => setShowStaleRestSheet(true)}
              >
                {pl.trainAnywayNew}
              </Button>
            )}
          </div>
        )}

        {!hasResume && bucket === 'paused' && (
          <Button
            size="touch"
            fullWidth
            onClick={async () => {
              await setProgramPaused(program, false)
              onReload()
            }}
          >
            {pl.resumeProgram}
          </Button>
        )}

        {!hasResume && bucket === 'test_pending_ready' && (
          <div className="flex flex-col gap-2">
            <Button
              size="touch"
              fullWidth
              onClick={() => void beginProgramSetup(navigate, program, { retest: true })}
            >
              {pl.retestNow}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => void beginLevelChange(navigate, program)}
            >
              {pl.menuChangeLevel}
            </Button>
          </div>
        )}

        {!hasResume && bucket === 'test_pending_rest' && (
          <Button
            variant="secondary"
            size="touch"
            fullWidth
            onClick={() => void beginLevelChange(navigate, program)}
          >
            {pl.menuChangeLevel}
          </Button>
        )}

        {!hasResume && (bucket === 'resting' || bucket === 'ready') && (
          <div className="flex flex-col gap-2">
            {program === 'pullups' &&
              bucket === 'resting' &&
              !trainDespiteRest &&
              enabledPrograms.includes('pushups') && (
              <Button
                variant="secondary"
                size="touch"
                fullWidth
                onClick={() => {
                  const el = document.getElementById('program-pushups')
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
              >
                {pl.crossTrainingCta}
              </Button>
            )}
            {bucket === 'resting' && !trainDespiteRest ? (
              <Button
                variant="ghost"
                size="touch"
                fullWidth
                onClick={() => setTrainDespiteRest(true)}
              >
                {pl.trainAnyway}
              </Button>
            ) : (
              <Button
                size="touch"
                fullWidth
                onClick={() => {
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
                }}
              >
                {pl.startDay(progress.currentDay)}
              </Button>
            )}
            {bucket === 'resting' && trainDespiteRest && (
              <Button variant="ghost" fullWidth onClick={() => setTrainDespiteRest(false)}>
                {pl.cancel}
              </Button>
            )}
          </div>
        )}
      </div>

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
        <Sheet
          open
          onClose={() => setShowStaleRestSheet(false)}
          title={pl.abandonOrTrainAnywayTitle}
        >
          <p className="mb-4 text-sm text-[var(--sr-text-secondary)]">
            {pl.abandonOrTrainAnywayBody} {pl.forceRestRestartHint}
          </p>
          <div className="flex flex-col gap-2 pb-2">
            <Button
              variant="secondary"
              fullWidth
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await abandonAllInProgress(program)
                  setShowStaleRestSheet(false)
                  onReload()
                } finally {
                  setBusy(false)
                }
              }}
            >
              {pl.abandonOnly}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              disabled={busy}
              onClick={() => {
                setShowStaleRestSheet(false)
                void abandonThenForce()
              }}
            >
              {pl.abandonAndTrain}
            </Button>
          </div>
        </Sheet>
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
    </ProgramAccentCard>
  )
}
