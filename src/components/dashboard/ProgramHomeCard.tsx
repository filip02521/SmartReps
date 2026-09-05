import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Play } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import { ProgramAccentCard } from '@/components/ui/ProgramAccentCard'
import { ProgramIcon } from '@/components/ui/ProgramIcon'
import { NestedStat } from '@/components/ui/NestedStat'
import { CycleDayRail } from '@/components/ui/CycleDayRail'
import { CycleDayPicker } from '@/components/ui/CycleDayPicker'
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
import { getMaxSetPerDay } from '@/lib/stats-engine'
import { getCycleById } from '@/data/plans'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { AccessibleChart } from '@/components/ui/AccessibleChart'
import { PROGRESS_CHART_TOOLTIP_STYLE } from '@/components/progress/chart-style'
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
  const [showCycleMap, setShowCycleMap] = useState(false)
  const [cycleMapDay, setCycleMapDay] = useState<number | null>(null)

  // When opening the cycle map, default to the current day (or day 1)
  // to avoid the anti-pattern of showing an empty details area.
  const openCycleMap = () => {
    setCycleMapDay(progress?.currentDay ?? 1)
    setShowCycleMap(true)
  }
  const [maxPerDay, setMaxPerDay] = useState<{ day: number; maxActual: number }[]>([])

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
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]"
            style={{
              background: program === 'pushups'
                ? 'color-mix(in srgb, var(--sr-pushups-accent) 15%, transparent)'
                : 'color-mix(in srgb, var(--sr-pullups-accent) 15%, transparent)',
            }}
            aria-hidden
          >
            <ProgramIcon program={program} size={20} />
          </div>
          <h2 className="min-w-0 break-words sr-text-h2 text-[var(--sr-text-primary)]">
            {model.label}
          </h2>
        </div>
        <div className="mt-3">
          <ErrorBanner message={model.loadError} onRetry={onReload} />
        </div>
      </ProgramAccentCard>
    )
  }

  if (bucket === 'unconfigured' || !progress) {
    return (
      <ProgramAccentCard program={program} id={`program-${program}`} className="scroll-mt-24">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]"
              style={{
                background: program === 'pushups'
                  ? 'color-mix(in srgb, var(--sr-pushups-accent) 15%, transparent)'
                : 'color-mix(in srgb, var(--sr-pullups-accent) 15%, transparent)',
              }}
              aria-hidden
            >
              <ProgramIcon program={program} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="min-w-0 break-words sr-text-h2 text-[var(--sr-text-primary)]">
                {model.label}
              </h2>
            </div>
          </div>
          <Badge variant="info">{pl.notConfigured}</Badge>
        </div>
        <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.notConfiguredHint}</p>
        <Button
          className="mt-4"
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
      {/* Header — compact: icon + title + badge inline, menu button right */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]"
            style={{
              background: program === 'pushups'
                ? 'color-mix(in srgb, var(--sr-pushups-accent) 15%, transparent)'
                : 'color-mix(in srgb, var(--sr-pullups-accent) 15%, transparent)',
            }}
            aria-hidden
          >
            <ProgramIcon program={program} size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="min-w-0 break-words sr-text-h2 text-[var(--sr-text-primary)]">
              {model.label}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={displayBadge.variant}>{displayBadge.label}</Badge>
          <button
            type="button"
            aria-label={pl.menuProgram}
            aria-haspopup="dialog"
            aria-expanded={showMenu}
            className={cn(
              'flex min-h-9 min-w-9 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
              FOCUS_RING,
            )}
            onClick={() => setShowMenu(true)}
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* Cycle name — subtle subtitle below title */}
      {model.cycleNameShort && (
        <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {model.cycleNameShort}
        </p>
      )}

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
            onClick={async () => {
              setShowMenu(false)
              if (progress) {
                setMaxPerDay(await getMaxSetPerDay(program, progress.cycleId, progress.cycleAttempt))
              }
              openCycleMap()
            }}
          >
            {pl.menuCycleMap}
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
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
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

          {/* Progress bar — accent-colored, subtle */}
          <div
            className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--sr-bg-surface)]"
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
        </div>
      )}

      {/* Session preview — compact, unified style */}
      {(() => {
        if (hasResume && resume) {
          return (
            <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[color-mix(in_srgb,var(--sr-brand-primary)_8%,var(--sr-bg-surface))] px-3.5 py-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="sr-text-overline text-[var(--sr-text-muted)]">{pl.statusInProgress}</p>
                <p className="sr-text-body-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
                  {pl.homeInProgressSets(resume.set, resume.total, resume.day)}
                </p>
              </div>
              <div className="flex gap-1.5" aria-hidden>
                {Array.from({ length: resume.total }, (_, i) => (
                  <span
                    key={i}
                    className="h-2 flex-1 rounded-full transition-colors"
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
            </div>
          )
        }
        if (bucket === 'paused') {
          return (
            <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3.5 py-3">
              <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.homeProgramPaused}</p>
            </div>
          )
        }
        if (bucket === 'test_pending_ready') return null
        if (bucket === 'resting' || bucket === 'test_pending_rest') {
          if (hideRestPreview) return null
          return (
            <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3.5 py-3">
              <p className="sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
                {pl.restPrimaryLabel(stats?.nextWorkoutLabel ?? pl.restIn(daysLeft))}
              </p>
              <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
                {bucket === 'resting'
                  ? pl.restGateHint(waitingRestDays)
                  : pl.homeCardTestRestHint(stats?.nextWorkoutLabel ?? pl.today)}
              </p>
            </div>
          )
        }
        if (bucket === 'ready' && model.currentDaySets && model.setsTargetTotal != null) {
          return (
            <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3.5 py-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="sr-text-overline text-[var(--sr-text-muted)]">{pl.homeTodaySession}</p>
                <p className="sr-text-body-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
                  {pl.plansDayReps(model.currentDaySets.length, model.setsTargetTotal)}
                </p>
              </div>
              <SetTargetsRow sets={model.currentDaySets} size="sm" />
            </div>
          )
        }
        return null
      })()}

      {stats &&
        (stats.lastSession ||
          stats.lastTotalReps !== null ||
          stats.maxLastSetTrend.delta !== null) && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {stats.lastSession && (
            <NestedStat
              size="sm"
              overline={pl.lastWorkout}
              value={pl.dayDoneCheck(stats.lastSession.dayNumber)}
            />
          )}
          <NestedStat
            size="sm"
            className={!stats.lastSession ? 'col-span-2' : undefined}
            overline={pl.nextWorkout}
            value={stats.nextWorkoutLabel}
          />
          {(stats.lastTotalReps !== null || stats.maxLastSetTrend.delta !== null) && (
            <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
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

      {/* Banners — subtle, compact */}
      {(() => {
        if (hasResume && resume?.stale && !tipSuppression.stale) {
          return (
            <div className="mt-2.5">
              <FeedbackBanner variant="warning" message={pl.staleSession} density="compact" />
            </div>
          )
        }
        if (isTestPending && !tipSuppression.test) {
          return (
            <div className="mt-2.5">
              <FeedbackBanner variant="info" message={pl.cycleCompleteHint} density="compact" />
            </div>
          )
        }
        if (hasResume && resting && !tipSuppression.stale) {
          return (
            <div className="mt-2.5">
              <FeedbackBanner variant="info" message={pl.resumeDespiteRestHint} density="compact" />
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
          return (
            <div className="mt-2.5">
              <FeedbackBanner
                variant="info"
                message={pl.considerLowerLevel}
                actionLabel={pl.menuChangeLevel}
                onAction={() => void beginLevelChange(navigate, program)}
                density="compact"
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
            <div className="mt-2.5">
              <FeedbackBanner
                variant="info"
                message={pl.considerLowerLevel}
                actionLabel={pl.menuChangeLevel}
                onAction={() => void beginLevelChange(navigate, program)}
                density="compact"
              />
            </div>
          )
        }
        return null
      })()}

      {/* CTA */}
      <div className="mt-4 border-t border-[var(--sr-border-subtle)] pt-4">
        {hasResume && resume && (
          <div className="flex flex-col gap-2">
            <Button
              size="touch"
              fullWidth
              disabled={busy}
              className="sr-pulse-cta"
              onClick={() => {
                if (resume.stale && !resting) setShowStaleConfirm(true)
                else navigate(`/workout/${program}?force=1`)
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <Play size={18} className="fill-current" />
                {pl.continueWorkout(resume.day, resume.set, resume.total)}
              </span>
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

      {showCycleMap && cycle && progress && (
        <Sheet
          open
          onClose={() => {
            setShowCycleMap(false)
            setCycleMapDay(null)
          }}
          title={pl.cycleMapTitle(cycle.nameShort)}
        >
          <div className="pb-2">
            <p className="mb-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
              {pl.progressCycleProgress(
                stats?.completedDaysInCycle ?? 0,
                stats?.cycleDaysTotal ?? cycle.days.length,
              )}
            </p>
            <CycleDayPicker
              totalDays={cycle.days.length}
              selectedDay={cycleMapDay}
              onSelect={setCycleMapDay}
              days={cycle.days.map((d) => ({
                dayNumber: d.dayNumber,
                status: getCycleDayStatus(progress, d.dayNumber, cycle.days.length),
              }))}
            />

            {cycleMapDay !== null && (
              <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
                <p className="sr-text-overline text-[var(--sr-text-muted)]">
                  {pl.dayLabel(cycleMapDay)}
                </p>
                {(() => {
                  const day = cycle.days.find((d) => d.dayNumber === cycleMapDay)
                  if (!day) return null
                  return (
                    <div className="mt-2">
                      <SetTargetsRow sets={day.sets} size="md" />
                      <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
                        {pl.restBetweenSets(day.restBetweenSetsSec)}
                      </p>
                    </div>
                  )
                })()}
              </div>
            )}

            {maxPerDay.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                  {pl.maxSetPerDay}
                </p>
                <AccessibleChart
                  label={pl.progressMaxSetChartAria(maxPerDay.length)}
                  data={maxPerDay.map((d) => ({ day: pl.dayLabel(d.day), max: d.maxActual }))}
                  columns={[
                    { key: 'day', header: pl.dayLabelShort },
                    { key: 'max', header: pl.repsUnit },
                  ]}
                  className="h-36 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={maxPerDay}>
                      <XAxis
                        dataKey="day"
                        tickFormatter={(d) => pl.chartDayShort(Number(d))}
                        tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                        stroke="var(--sr-border-subtle)"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                        stroke="var(--sr-border-subtle)"
                        width={28}
                      />
                      <Tooltip
                        contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
                        formatter={(value) => [value ?? 0, pl.repsUnit]}
                        labelFormatter={(label) => String(label)}
                        cursor={{ fill: 'var(--sr-brand-primary-muted)' }}
                      />
                      <Bar dataKey="maxActual" fill="var(--sr-brand-primary)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </AccessibleChart>
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              fullWidth
              onClick={() => {
                setShowCycleMap(false)
                setCycleMapDay(null)
                navigate(`/plans?tab=programs&highlight=${progress.cycleId}`)
              }}
            >
              {pl.progressFullCyclePlan}
            </Button>
          </div>
        </Sheet>
      )}
    </ProgramAccentCard>
  )
}
