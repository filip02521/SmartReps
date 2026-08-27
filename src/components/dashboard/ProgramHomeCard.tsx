import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import { Card, Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { ErrorBanner, FeedbackBanner } from '@/components/ux/Feedback'
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
  onReload,
}: {
  model: ProgramCardModel
  tipSuppression: TipSuppression
  onReload: () => void
}) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [trainDespiteRest, setTrainDespiteRest] = useState(false)
  const [showStaleConfirm, setShowStaleConfirm] = useState(false)
  const [showTrainAnywayConfirm, setShowTrainAnywayConfirm] = useState(false)
  const [showStaleRestSheet, setShowStaleRestSheet] = useState(false)
  const [pendingSetup, setPendingSetup] = useState<'level' | 'retest' | null>(null)
  const [busy, setBusy] = useState(false)

  const { program, bucket, progress, stats, resume, available, daysLeft } = model
  const isPaused = progress?.status === 'paused'
  const isTestPending = progress?.status === 'test_pending'
  const resting = bucket === 'resting' || (resume != null && !available && !isPaused && !isTestPending)
  const hasResume = bucket === 'resume' || bucket === 'resume_stale'
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
      <Card className="border-l-4" style={{ borderLeftColor: model.accent }}>
        <p className="mb-3 font-semibold text-[var(--sr-text-primary)]">{model.label}</p>
        <ErrorBanner message={model.loadError} onRetry={onReload} />
      </Card>
    )
  }

  if (bucket === 'unconfigured' || !progress) {
    return (
      <Card
        id={`program-${program}`}
        className="scroll-mt-24 border-l-4"
        style={{ borderLeftColor: model.accent }}
      >
        <p className="font-semibold text-[var(--sr-text-primary)]">{model.label}</p>
        <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{pl.notConfigured}</p>
        <Button
          className="mt-5"
          size="touch"
          fullWidth
          onClick={() => navigate(`/setup/test/${program}`)}
        >
          {pl.startSetup}
        </Button>
      </Card>
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
    <Card
      id={`program-${program}`}
      className="scroll-mt-24 border-l-4"
      style={{ borderLeftColor: model.accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-tight text-[var(--sr-text-primary)]">
            {model.label}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={displayBadge.variant}>{displayBadge.label}</Badge>
            {model.cycleNameShort && (
              <span className="text-xs text-[var(--sr-text-muted)]">{model.cycleNameShort}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label={pl.menuProgram}
          aria-haspopup="dialog"
          aria-expanded={showMenu}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] hover:bg-[var(--sr-bg-surface)]"
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
              navigate('/progress')
            }}
          >
            {pl.menuHistory}
          </Button>
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium tabular-nums text-[var(--sr-text-secondary)]">
              {isTestPending
                ? pl.cycleDoneDays(cycle.days.length, cycle.days.length)
                : pl.dayOfTotal(progress.currentDay, cycle.days.length)}
              {' · '}
              {pl.attemptLabel(progress.cycleAttempt)}
              {' · '}
              {pct}%
            </p>
          </div>

          <div className="flex items-end gap-1.5" role="list" aria-label={pl.cycleDays}>
            {cycle.days.map((d) => {
              const dayStatus = getCycleDayStatus(progress, d.dayNumber, cycle.days.length)
              const isCurrent = dayStatus === 'current'
              return (
                <div
                  key={d.dayNumber}
                  role="listitem"
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`${pl.dayOfTotal(d.dayNumber, cycle.days.length)} — ${dayStatus}`}
                  className={`flex-1 rounded-full motion-reduce:transition-none ${
                    isCurrent ? 'h-3 transition-[height] duration-200' : 'h-2.5'
                  }`}
                  style={{
                    background:
                      dayStatus === 'completed'
                        ? 'var(--sr-success)'
                        : dayStatus === 'current'
                          ? 'var(--sr-brand-primary)'
                          : 'color-mix(in srgb, var(--sr-text-muted) 22%, transparent)',
                  }}
                />
              )
            })}
          </div>
          {!isTestPending &&
            cycle.days.some(
              (d) => getCycleDayStatus(progress, d.dayNumber, cycle.days.length) === 'current',
            ) && (
              <p className="mt-1.5 text-xs text-[var(--sr-text-muted)]">
                {pl.homeNowDay(progress.currentDay)}
              </p>
            )}
        </div>
      )}

      {/* Session preview */}
      {(() => {
        if (hasResume && resume) {
          return (
            <div className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
              <p className="text-sm font-semibold text-[var(--sr-text-primary)]">
                {pl.homeInProgressSets(resume.set, resume.total, resume.day)}
              </p>
              <div className="mt-2 flex gap-1.5" aria-hidden>
                {Array.from({ length: resume.total }, (_, i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full"
                    style={{
                      background:
                        i < resume.currentSetIndex
                          ? 'var(--sr-success)'
                          : i === resume.currentSetIndex
                            ? 'var(--sr-brand-primary)'
                            : 'color-mix(in srgb, var(--sr-text-muted) 30%, transparent)',
                    }}
                  />
                ))}
              </div>
            </div>
          )
        }
        if (bucket === 'paused') {
          return (
            <div className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
              <p className="text-sm text-[var(--sr-text-secondary)]">{pl.homeProgramPaused}</p>
            </div>
          )
        }
        if (bucket === 'test_pending_ready') return null
        if (bucket === 'resting' || bucket === 'test_pending_rest') {
          // Tip rest_all already communicates regeneration — skip duplicate rest title.
          if (tipSuppression.allRest && bucket === 'resting') return null
          return (
            <div className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
              <p className="text-sm font-semibold text-[var(--sr-text-primary)]">
                {pl.restPrimaryLabel(stats?.nextWorkoutLabel ?? pl.restIn(daysLeft))}
              </p>
              {bucket === 'resting' && (
                <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                  {pl.restGateHint(waitingRestDays)}
                </p>
              )}
              {bucket === 'test_pending_rest' && (
                <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                  {pl.homeTipTestRest(stats?.nextWorkoutLabel ?? pl.today)}
                </p>
              )}
            </div>
          )
        }
        if (bucket === 'ready' && model.setsPreviewLine && model.setsTargetTotal != null) {
          return (
            <div className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
                {pl.homeTodaySession}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--sr-text-primary)]">
                {pl.homeSessionSetsSummary(
                  model.currentDaySets?.length ?? 0,
                  model.setsTargetTotal,
                )}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--sr-text-secondary)]">
                {model.setsPreviewLine}
              </p>
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
            <div className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
                {pl.lastWorkout}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
                {pl.dayDoneCheck(stats.lastSession.dayNumber)}
              </p>
            </div>
          )}
          <div
            className={`rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5 ${
              !stats.lastSession ? 'col-span-2' : ''
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
              {pl.nextWorkout}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
              {stats.nextWorkoutLabel}
            </p>
          </div>
          {(stats.lastTotalReps !== null || stats.maxLastSetTrend.delta !== null) && (
            <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5 text-sm text-[var(--sr-text-secondary)]">
              {stats.lastTotalReps !== null && (
                <span>{pl.totalRepsLastSession(stats.lastTotalReps)}</span>
              )}
              {stats.maxLastSetTrend.delta !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[var(--sr-text-muted)]">{pl.maxSetTrend}</span>
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
          !tipSuppression.allRest &&
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

      {program === 'pullups' && bucket === 'resting' && !hasResume && (
        <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3">
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.crossTraining}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            fullWidth
            onClick={() => {
              const el = document.getElementById('program-pushups')
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
          >
            {pl.crossTrainingCta}
          </Button>
        </div>
      )}

      {/* CTA */}
      <div className="mt-5 border-t border-[var(--sr-border-subtle)] pt-4">
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
          <div className="flex flex-col gap-2">
            <Button variant="ghost" size="touch" fullWidth disabled>
              {pl.testPendingRestLabel(stats?.nextWorkoutLabel ?? pl.restIn(daysLeft))}
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

        {!hasResume && (bucket === 'resting' || bucket === 'ready') && (
          <div className="flex flex-col gap-2">
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
                  navigate(
                    trainDespiteRest || !available
                      ? `/workout/${program}?force=1`
                      : `/workout/${program}`,
                  )
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
    </Card>
  )
}
