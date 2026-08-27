import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import { LogoFull } from '@/components/brand/Logo'
import { Card, Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import {
  getProgramProgress,
  getStatusLabel,
  getStatusTone,
  getActiveWorkout,
  clearActiveWorkout,
} from '@/lib/program-service'
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

function ProgramCard({
  program,
  reloadKey,
}: {
  program: Program
  reloadKey: number
}) {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<LocalProgramProgress | undefined>()
  const [stats, setStats] = useState<ProgramStats | null>(null)
  const [resume, setResume] = useState<{ day: number; set: number; total: number; stale?: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [trainDespiteRest, setTrainDespiteRest] = useState(false)
  const [showStaleConfirm, setShowStaleConfirm] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)
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

  if (loading) return <SkeletonCard className="h-40" />

  if (loadError) {
    return (
      <Card className="border-l-4 sr-card" style={{ borderLeftColor: programMeta[program].accent }}>
        <ErrorBanner message={loadError} onRetry={() => window.location.reload()} />
      </Card>
    )
  }

  if (!progress) {
    return (
      <Card className="border-l-4 sr-card" style={{ borderLeftColor: programMeta[program].accent }}>
        <p className="font-semibold">{programMeta[program].label}</p>
        <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{pl.notConfigured}</p>
        <Button className="mt-4" fullWidth onClick={() => navigate(`/setup/test/${program}`)}>
          {pl.startSetup}
        </Button>
      </Card>
    )
  }

  const cycle = getCycleById(progress.cycleId)
  const status = getStatusLabel(progress)
  const badgeVariant = getStatusTone(progress)
  const available = isWorkoutAvailable(
    progress.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const daysLeft = daysUntilWorkout(
    progress.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const canStart =
    progress.status === 'test_pending'
      ? false
      : available || trainDespiteRest

  return (
    <Card id={`program-${program}`} className="border-l-4 sr-card scroll-mt-24" style={{ borderLeftColor: programMeta[program].accent }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">{programMeta[program].label}</p>
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariant}>{status}</Badge>
          <button
            type="button"
            aria-label={pl.menuProgram}
            aria-expanded={showMenu}
            className="flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => setShowMenu((v) => !v)}
          >
            <MoreVertical size={18} className="text-[var(--sr-text-muted)]" />
          </button>
        </div>
      </div>

      {showMenu && (
        <>
          <button type="button" className="fixed inset-0 z-10" aria-label={pl.close} onClick={() => setShowMenu(false)} />
          <div className="relative z-20 mb-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] py-1 text-sm">
            <button type="button" className="block min-h-11 w-full px-3 py-2 text-left" onClick={() => { setShowMenu(false); navigate(`/setup/test/${program}`) }}>
              {pl.menuChangeLevel}
            </button>
            <button type="button" className="block min-h-11 w-full px-3 py-2 text-left" onClick={() => { setShowMenu(false); navigate('/progress') }}>
              {pl.menuHistory}
            </button>
            <button type="button" className="block min-h-11 w-full px-3 py-2 text-left" onClick={() => { setShowMenu(false); navigate(`/setup/test/${program}?retest=1`) }}>
              {pl.menuRetest}
            </button>
          </div>
        </>
      )}

      {cycle && (
        <>
          <div className="mb-2 flex gap-1" role="list" aria-label={pl.cycleDays}>
            {cycle.days.map((d) => {
              const dayStatus = getCycleDayStatus(progress, d.dayNumber, cycle.days.length)
              return (
              <div
                key={d.dayNumber}
                role="listitem"
                aria-label={`${pl.dayOfTotal(d.dayNumber, cycle.days.length)} — ${dayStatus}`}
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background:
                    dayStatus === 'completed'
                      ? 'var(--sr-success)'
                      : dayStatus === 'current'
                        ? 'var(--sr-brand-primary)'
                        : 'var(--sr-bg-surface)',
                }}
              />
              )
            })}
          </div>
          <p className="text-sm text-[var(--sr-text-secondary)]">
            {cycle.nameShort} ·{' '}
            {progress.status === 'test_pending'
              ? pl.cycleDoneDays(cycle.days.length, cycle.days.length)
              : pl.dayOfTotal(progress.currentDay, cycle.days.length)}{' '}
            · {pl.attemptLabel(progress.cycleAttempt)}
          </p>

          {stats && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--sr-text-secondary)]">
              <div>
                <p className="text-[var(--sr-text-muted)]">{pl.lastWorkout}</p>
                <p>{stats.lastSession ? `Dzień ${stats.lastSession.dayNumber} ✓` : '—'}</p>
              </div>
              <div>
                <p className="text-[var(--sr-text-muted)]">{pl.nextWorkout}</p>
                <p>{stats.nextWorkoutLabel}</p>
              </div>
              {stats.lastTotalReps !== null && (
                <p className="col-span-2">{pl.totalRepsLastSession(stats.lastTotalReps)}</p>
              )}
              {stats.maxLastSetTrend.delta !== null && (
                <p className="col-span-2">
                  {pl.maxSetTrend}: {stats.maxLastSetTrend.current}{' '}
                  <TrendIndicator delta={stats.maxLastSetTrend.delta} />
                </p>
              )}
            </div>
          )}

          {!available && !trainDespiteRest && (
            <p className="mt-2 text-sm font-medium text-[var(--sr-warning)]">
              {pl.restBlocked(pl.restIn(daysLeft))}
            </p>
          )}

          {program === 'pullups' && status === pl.statusRest && (
            <div className="mt-2">
              <p className="text-xs text-[var(--sr-text-muted)]">{pl.crossTraining}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 min-h-11 px-0"
                onClick={() => {
                  const el = document.getElementById('program-pushups')
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  el?.classList.add('ring-2', 'ring-[var(--sr-brand-primary)]', 'rounded-[var(--sr-radius-lg)]')
                  window.setTimeout(() => {
                    el?.classList.remove('ring-2', 'ring-[var(--sr-brand-primary)]', 'rounded-[var(--sr-radius-lg)]')
                  }, 2000)
                }}
              >
                {pl.crossTrainingCta}
              </Button>
            </div>
          )}
        </>
      )}

      {resume && progress.status !== 'test_pending' && (
        <>
          {resume.stale && (
            <p className="mt-3 rounded-[var(--sr-radius-md)] bg-[var(--sr-warning)]/15 p-3 text-sm text-[var(--sr-warning)]">
              {pl.staleSession}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button
              fullWidth
              onClick={() => {
                if (resume.stale) setShowStaleConfirm(true)
                else navigate(`/workout/${program}`)
              }}
            >
              {pl.continueWorkout(resume.day, resume.set, resume.total)}
            </Button>
            {resume.stale && (
              <Button
                variant="ghost"
                fullWidth
                onClick={async () => {
                  await clearActiveWorkout(program)
                  setResume(null)
                }}
              >
                {pl.startFresh}
              </Button>
            )}
          </div>
        </>
      )}

      {showStaleConfirm && resume && (
        <ConfirmSheet
          title={pl.staleSessionTitle}
          message={pl.staleSessionConfirm}
          confirmLabel={pl.continueWorkout(resume.day, resume.set, resume.total)}
          cancelLabel={pl.startFresh}
          onConfirm={() => {
            setShowStaleConfirm(false)
            navigate(`/workout/${program}`)
          }}
          onCancel={async () => {
            await clearActiveWorkout(program)
            setResume(null)
            setShowStaleConfirm(false)
          }}
        />
      )}

      {!resume && (
        <>
          {!canStart && progress.status !== 'test_pending' && (
            <Button variant="secondary" className="mt-4" fullWidth onClick={() => setTrainDespiteRest(true)}>
              {pl.trainAnyway}
            </Button>
          )}
          <Button
            className="mt-2"
            fullWidth
            disabled={!canStart && progress.status !== 'test_pending'}
            onClick={() => {
              if (progress.status === 'test_pending') {
                navigate(`/setup/test/${program}?retest=1`)
              } else {
                navigate(trainDespiteRest ? `/workout/${program}?force=1` : `/workout/${program}`)
              }
            }}
          >
            {progress.status === 'test_pending' ? pl.test : pl.startDay(progress.currentDay)}
          </Button>
        </>
      )}
    </Card>
  )
}

export default function Dashboard() {
  const { settings, setupQueue } = useAppStore()
  const navigate = useNavigate()
  const [resumeEpoch] = useState(0)

  useEffect(() => {
    if (!settings.onboardingComplete) {
      navigate('/setup/onboarding')
      return
    }
    let cancelled = false
    async function drainQueue() {
      while (!cancelled) {
        const next = useAppStore.getState().setupQueue[0]
        if (!next) return
        const p = await getProgramProgress(next)
        useAppStore.getState().shiftSetupQueue()
        if (!p) {
          navigate(`/setup/test/${next}`)
          return
        }
      }
    }
    void drainQueue()
    return () => {
      cancelled = true
    }
  }, [settings.onboardingComplete, navigate, setupQueue])

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top">
      <header className="mb-6">
        <LogoFull />
      </header>

      <div className="flex flex-col gap-4">
        {settings.enabledPrograms.map((p) => (
          <ProgramCard key={`${p}-${resumeEpoch}`} program={p} reloadKey={resumeEpoch} />
        ))}
      </div>
    </div>
  )
}
