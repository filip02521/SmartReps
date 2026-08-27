import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import { LogoFull, LogoMark } from '@/components/brand/Logo'
import { Card, Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import {
  SkeletonCard,
  ErrorBanner,
  PageLoader,
  FeedbackBanner,
  EmptyState,
} from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import {
  getProgramProgress,
  getStatusLabel,
  getStatusTone,
  getActiveWorkout,
  setProgramPaused,
} from '@/lib/program-service'
import { abandonAllInProgress } from '@/lib/session-service'
import { beginLevelChange, beginProgramSetup, drainIncompleteSetup } from '@/lib/setup-flow'
import { isStaleActiveWorkout } from '@/lib/sync'
import { getProgramStats, type ProgramStats } from '@/lib/stats-engine'
import { getCycleById } from '@/data/plans'
import { daysUntilWorkout, isWorkoutAvailable } from '@/lib/progress-engine'
import type { LocalProgramProgress } from '@/lib/db'
import type { Program } from '@/data/plans/types'
import { getCycleDayStatus } from '@/lib/cycle-progress'

const programMeta: Record<Program, { label: string; accent: string }> = {
  pushups: { label: pl.pushupsProgram, accent: 'var(--sr-pushups-accent)' },
  pullups: { label: pl.pullupsProgram, accent: 'var(--sr-pullups-accent)' },
}

function toneToBadge(
  tone: ReturnType<typeof getStatusTone>,
): 'success' | 'warning' | 'error' | 'info' {
  if (tone === 'success') return 'success'
  if (tone === 'warning') return 'warning'
  if (tone === 'error') return 'error'
  return 'info'
}

function ProgramCard({
  program,
  reloadKey,
  onReload,
}: {
  program: Program
  reloadKey: number
  onReload: () => void
}) {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<LocalProgramProgress | undefined>()
  const [stats, setStats] = useState<ProgramStats | null>(null)
  const [resume, setResume] = useState<{ day: number; set: number; total: number; stale?: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [trainDespiteRest, setTrainDespiteRest] = useState(false)
  const [showStaleConfirm, setShowStaleConfirm] = useState(false)
  const [pendingSetup, setPendingSetup] = useState<'level' | 'retest' | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)
      setTrainDespiteRest(false)
      try {
        const prog = await getProgramProgress(program)
        setProgress(prog)
        if (prog) {
          setStats(await getProgramStats(program, prog))
          const active = await getActiveWorkout(program)
          if (active) {
            const cycle = getCycleById(prog.cycleId)
            const day = cycle?.days.find((d) => d.dayNumber === prog.currentDay)
            setResume({
              day: prog.currentDay,
              set: active.currentSetIndex + 1,
              total: day?.sets.length ?? 5,
              stale: isStaleActiveWorkout(active.updatedAt),
            })
          } else {
            setResume(null)
          }
        }
      } catch {
        setLoadError(pl.errorLoadProgram)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [program, reloadKey])

  if (loading) {
    return <SkeletonCard className="min-h-[17rem]" />
  }

  if (loadError) {
    return (
      <Card className="border-l-4" style={{ borderLeftColor: programMeta[program].accent }}>
        <p className="mb-3 font-semibold text-[var(--sr-text-primary)]">{programMeta[program].label}</p>
        <ErrorBanner message={loadError} onRetry={onReload} />
      </Card>
    )
  }

  if (!progress) {
    return (
      <Card className="border-l-4" style={{ borderLeftColor: programMeta[program].accent }}>
        <p className="font-semibold text-[var(--sr-text-primary)]">{programMeta[program].label}</p>
        <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{pl.notConfigured}</p>
        <Button className="mt-5" size="touch" fullWidth onClick={() => navigate(`/setup/test/${program}`)}>
          {pl.startSetup}
        </Button>
      </Card>
    )
  }

  const cycle = getCycleById(progress.cycleId)
  const available = isWorkoutAvailable(
    progress.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const daysLeft = daysUntilWorkout(
    progress.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const isPaused = progress.status === 'paused'
  const isTestPending = progress.status === 'test_pending'
  const resting = !available && !isPaused && !isTestPending
  const hasResume = !!resume && !isTestPending

  const displayBadge = hasResume
    ? { label: pl.statusInProgress, variant: 'info' as const }
    : { label: getStatusLabel(progress), variant: toneToBadge(getStatusTone(progress)) }

  const canStart =
    isPaused || isTestPending
      ? false
      : available || trainDespiteRest

  const waitingRestDays = Math.max(1, daysLeft)

  return (
    <Card
      id={`program-${program}`}
      className="scroll-mt-24 border-l-4"
      style={{ borderLeftColor: programMeta[program].accent }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-tight text-[var(--sr-text-primary)]">
            {programMeta[program].label}
          </h2>
          <div className="mt-2">
            <Badge variant={displayBadge.variant}>{displayBadge.label}</Badge>
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
            <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
              {cycle.nameShort}
            </p>
            <p className="shrink-0 text-xs font-medium tabular-nums text-[var(--sr-text-muted)]">
              {isTestPending
                ? pl.cycleDoneDays(cycle.days.length, cycle.days.length)
                : pl.dayOfTotal(progress.currentDay, cycle.days.length)}
              {' · '}
              {pl.attemptLabel(progress.cycleAttempt)}
            </p>
          </div>

          <div className="flex gap-1.5" role="list" aria-label={pl.cycleDays}>
            {cycle.days.map((d) => {
              const dayStatus = getCycleDayStatus(progress, d.dayNumber, cycle.days.length)
              return (
                <div
                  key={d.dayNumber}
                  role="listitem"
                  aria-label={`${pl.dayOfTotal(d.dayNumber, cycle.days.length)} — ${dayStatus}`}
                  className="h-2.5 flex-1 rounded-full"
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

          {stats && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
                  {pl.lastWorkout}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
                  {stats.lastSession ? pl.dayDoneCheck(stats.lastSession.dayNumber) : '—'}
                </p>
              </div>
              <div className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
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
        </div>
      )}

      {/* Context banners */}
      {hasResume && resting && (
        <div className="mt-4">
          <FeedbackBanner variant="info" message={pl.resumeDespiteRestHint} />
        </div>
      )}

      {!hasResume && resting && !trainDespiteRest && (
        <div className="mt-4 space-y-2">
          <FeedbackBanner
            variant="warning"
            message={pl.restBlocked(pl.restIn(daysLeft))}
          />
          <p className="px-0.5 text-xs leading-relaxed text-[var(--sr-text-muted)]">
            {pl.restGateHint(waitingRestDays)}
          </p>
        </div>
      )}

      {hasResume && resume?.stale && (
        <div className="mt-4">
          <FeedbackBanner variant="warning" message={pl.staleSession} />
        </div>
      )}

      {program === 'pullups' && resting && !hasResume && (
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
              el?.classList.add('ring-2', 'ring-[var(--sr-brand-primary)]')
              window.setTimeout(() => {
                el?.classList.remove('ring-2', 'ring-[var(--sr-brand-primary)]')
              }, 1800)
            }}
          >
            {pl.crossTrainingCta}
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 border-t border-[var(--sr-border-subtle)] pt-4">
        {hasResume && resume && (
          <div className="flex flex-col gap-2">
            <Button
              size="touch"
              fullWidth
              onClick={() => {
                if (resume.stale) setShowStaleConfirm(true)
                else navigate(`/workout/${program}?force=1`)
              }}
            >
              {pl.continueWorkout(resume.day, resume.set, resume.total)}
            </Button>
            {resume.stale && (
              <Button
                variant="ghost"
                fullWidth
                onClick={async () => {
                  await abandonAllInProgress(program)
                  setResume(null)
                }}
              >
                {pl.startFresh}
              </Button>
            )}
          </div>
        )}

        {!hasResume && isPaused && (
          <Button
            variant="secondary"
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

        {!hasResume && isTestPending && (
          <Button
            size="touch"
            fullWidth
            onClick={() => void beginProgramSetup(navigate, program, { retest: true })}
          >
            {pl.test}
          </Button>
        )}

        {!hasResume && !isPaused && !isTestPending && (
          <div className="flex flex-col gap-2">
            {resting && !trainDespiteRest ? (
              <Button
                variant="secondary"
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
                disabled={!canStart}
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
            {resting && trainDespiteRest && (
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setTrainDespiteRest(false)}
              >
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
            setResume(null)
            setShowStaleConfirm(false)
          }}
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
    </Card>
  )
}

export default function Dashboard() {
  const settings = useAppStore((s) => s.settings)
  const navigate = useNavigate()
  const hydrated = useStoreHydrated()
  const [resumeEpoch, setResumeEpoch] = useState(0)

  useEffect(() => {
    if (!hydrated || !settings.onboardingComplete) return
    let cancelled = false
    void (async () => {
      const safeNavigate: typeof navigate = ((to, options) => {
        if (cancelled) return
        navigate(to, options)
      }) as typeof navigate
      await drainIncompleteSetup(safeNavigate)
    })()
    return () => {
      cancelled = true
    }
  }, [hydrated, settings.onboardingComplete, settings.enabledPrograms, navigate])

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 safe-top">
        <PageLoader />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top safe-bottom">
      <header className="mb-6">
        <LogoFull height={24} />
        <h1 className="mt-4 sr-text-h1">{pl.navWorkout}</h1>
        <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.dashboardSubtitle}
        </p>
      </header>

      {settings.enabledPrograms.length === 0 ? (
        <EmptyState
          icon={<LogoMark size={48} />}
          title={pl.noProgramsTitle}
          description={pl.noProgramsDesc}
          action={{ label: pl.goToProfile, onClick: () => navigate('/profile') }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {settings.enabledPrograms.map((p) => (
            <ProgramCard
              key={`${p}-${resumeEpoch}`}
              program={p}
              reloadKey={resumeEpoch}
              onReload={() => setResumeEpoch((n) => n + 1)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
