import { useEffect, useState, useCallback } from 'react'
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
  onGlobalResume,
}: {
  program: Program
  onGlobalResume: (info: {
    program: Program
    day?: number
    set?: number
    total?: number
    stale?: boolean
    clear?: boolean
  }) => void
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
            const info = {
              day: prog.currentDay,
              set: active.currentSetIndex + 1,
              total: day?.sets.length ?? 5,
              stale: isStaleActiveWorkout(active.updatedAt),
            }
            setResume(info)
            onGlobalResume({ program, ...info })
          } else {
            setResume(null)
            onGlobalResume({ program, clear: true })
          }
        }
      } catch {
        setLoadError('Nie udało się załadować programu.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [program, onGlobalResume])

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

  const badgeVariant =
    status === 'Gotowy' ? 'success' : status === 'Przerwa' ? 'warning' : status === 'Test' ? 'info' : 'error'

  return (
    <Card id={`program-${program}`} className="border-l-4 sr-card scroll-mt-24" style={{ borderLeftColor: programMeta[program].accent }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">{programMeta[program].label}</p>
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariant}>{status}</Badge>
          <button type="button" aria-label="Menu programu" onClick={() => setShowMenu((v) => !v)}>
            <MoreVertical size={18} className="text-[var(--sr-text-muted)]" />
          </button>
        </div>
      </div>

      {showMenu && (
        <div className="mb-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] py-1 text-sm">
          <button type="button" className="block w-full px-3 py-2 text-left" onClick={() => navigate(`/setup/test/${program}`)}>
            {pl.menuChangeLevel}
          </button>
          <button type="button" className="block w-full px-3 py-2 text-left" onClick={() => navigate('/progress')}>
            {pl.menuHistory}
          </button>
          <button type="button" className="block w-full px-3 py-2 text-left" onClick={() => navigate(`/setup/test/${program}?retest=1`)}>
            {pl.menuRetest}
          </button>
        </div>
      )}

      {cycle && (
        <>
          <div className="mb-2 flex gap-1">
            {cycle.days.map((d) => {
              const dayStatus = getCycleDayStatus(progress, d.dayNumber, cycle.days.length)
              return (
              <div
                key={d.dayNumber}
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
              ? `Cykl ukończony · ${cycle.days.length}/${cycle.days.length} dni`
              : `Dzień ${progress.currentDay}/${cycle.days.length}`}{' '}
            · Próba {progress.cycleAttempt}
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
                <p className="col-span-2">{stats.lastTotalReps} reps łącznie (ostatni trening)</p>
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

          {program === 'pullups' && status === 'Przerwa' && (
            <div className="mt-2">
              <p className="text-xs text-[var(--sr-text-muted)]">{pl.crossTraining}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 px-0"
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
  const { settings, setupQueue, shiftSetupQueue } = useAppStore()
  const navigate = useNavigate()
  const [resumeByProgram, setResumeByProgram] = useState<
    Partial<Record<Program, { day: number; set: number; total: number; stale?: boolean }>>
  >({})

  const handleGlobalResume = useCallback((info: {
    program: Program
    day?: number
    set?: number
    total?: number
    stale?: boolean
    clear?: boolean
  }) => {
    if (info.clear) {
      setResumeByProgram((prev) => {
        const next = { ...prev }
        delete next[info.program]
        return next
      })
      return
    }
    if (info.day != null && info.set != null && info.total != null) {
      setResumeByProgram((prev) => ({
        ...prev,
        [info.program]: { day: info.day!, set: info.set!, total: info.total!, stale: info.stale },
      }))
    }
  }, [])

  useEffect(() => {
    if (!settings.onboardingComplete) {
      navigate('/setup/onboarding')
      return
    }
    const next = setupQueue[0]
    if (next) {
      getProgramProgress(next).then((p) => {
        if (!p) {
          shiftSetupQueue()
          navigate(`/setup/test/${next}`)
        }
      })
    }
  }, [settings.onboardingComplete, navigate, setupQueue, shiftSetupQueue])

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top">
      <header className="mb-6">
        <LogoFull />
      </header>

      {Object.entries(resumeByProgram).map(([prog, resume]) => {
        if (!resume) return null
        const programKey = prog as Program
        return (
        <Card key={prog} className="mb-4 border border-[var(--sr-brand-primary)] sr-card">
          <p className="text-sm font-medium">
            {programMeta[programKey].label}: {pl.continueWorkout(resume.day, resume.set, resume.total)}
          </p>
          {resume.stale && (
            <p className="mt-1 text-xs text-[var(--sr-warning)]">{pl.staleSession}</p>
          )}
          <Button className="mt-3" size="sm" fullWidth onClick={() => navigate(`/workout/${prog}`)}>
            {pl.continueWorkout(resume.day, resume.set, resume.total)}
          </Button>
        </Card>
        )
      })}

      <div className="flex flex-col gap-4">
        {settings.enabledPrograms.map((p) => (
          <ProgramCard key={p} program={p} onGlobalResume={handleGlobalResume} />
        ))}
      </div>
    </div>
  )
}
