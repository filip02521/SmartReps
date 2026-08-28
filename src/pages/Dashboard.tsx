import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogoFull, LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { PageLoader, SkeletonCard, EmptyState } from '@/components/ux/Feedback'
import { HomeSummary } from '@/components/dashboard/HomeSummary'
import { HomeTip } from '@/components/dashboard/HomeTip'
import { ProgramHomeCard } from '@/components/dashboard/ProgramHomeCard'
import { InstallCoach } from '@/components/ux/InstallCoach'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { drainIncompleteSetup, beginLevelChange } from '@/lib/setup-flow'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import {
  loadHomeDashboard,
  localDayKey,
  type HomeLoadResult,
} from '@/lib/home-summary'
import type { Program } from '@/data/plans/types'

function scrollToProgram(program: Program) {
  const el = document.getElementById(`program-${program}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export default function Dashboard() {
  const settings = useAppStore((s) => s.settings)
  const dismissedHomeTipId = useAppStore((s) => s.dismissedHomeTipId)
  const dismissedHomeTipDay = useAppStore((s) => s.dismissedHomeTipDay)
  const hasCompletedFirstWorkout = useAppStore((s) => s.hasCompletedFirstWorkout)
  const dismissedLoginBackupTip = useAppStore((s) => s.dismissedLoginBackupTip)
  const hasSeenLoginCloudPrompt = useAppStore((s) => s.hasSeenLoginCloudPrompt)
  const dismissHomeTip = useAppStore((s) => s.dismissHomeTip)
  const setDismissedLoginBackupTip = useAppStore((s) => s.setDismissedLoginBackupTip)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const hydrated = useStoreHydrated()
  const [reloadEpoch, setReloadEpoch] = useState(0)
  const [home, setHome] = useState<HomeLoadResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  /** null = InstallCoach not yet reported — tip withheld to avoid dual attention. */
  const [installVisible, setInstallVisible] = useState<boolean | null>(null)

  const onInstallVisibility = useCallback((v: boolean) => {
    setInstallVisible(v)
  }, [])

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

  useEffect(() => {
    if (!hydrated) return
    if (!isSupabaseConfigured) {
      setHasSession(false)
      return
    }
    void supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session))
  }, [hydrated, reloadEpoch])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    setLoading(true)
    const showLoginBackup =
      installVisible === false &&
      hasCompletedFirstWorkout &&
      !dismissedLoginBackupTip &&
      !hasSeenLoginCloudPrompt &&
      hasSession === false
    void loadHomeDashboard(settings.enabledPrograms, {
      dismissedHomeTipId,
      dismissedHomeTipDay,
      showLoginBackup,
    }).then((result) => {
      if (!cancelled) {
        setHome(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [
    hydrated,
    settings.enabledPrograms,
    reloadEpoch,
    dismissedHomeTipId,
    dismissedHomeTipDay,
    installVisible,
    hasCompletedFirstWorkout,
    dismissedLoginBackupTip,
    hasSeenLoginCloudPrompt,
    hasSession,
  ])

  useEffect(() => {
    if (!hydrated || loading || !home) return
    const programParam = searchParams.get('program')
    if (programParam !== 'pushups' && programParam !== 'pullups') return
    scrollToProgram(programParam)
    setSearchParams({}, { replace: true })
  }, [hydrated, loading, home, searchParams, setSearchParams])

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <PageLoader />
      </div>
    )
  }

  const reload = () => setReloadEpoch((n) => n + 1)
  const showTip = installVisible === false && !!home?.tip
  const canChooseTraining =
    home?.cards.some(
      (c) =>
        c.bucket === 'ready' ||
        c.bucket === 'resume' ||
        c.bucket === 'resume_stale' ||
        c.bucket === 'test_pending_ready',
    ) ?? false

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-5">
        <LogoFull height={36} />
        <h1 className="sr-only">{pl.navWorkout}</h1>
      </header>

      {loading || !home ? (
        <>
          <div className="mb-5 space-y-3" aria-busy aria-label={pl.loading}>
            <SkeletonCard className="min-h-[3.5rem]" />
            <div className="grid grid-cols-2 gap-2">
              <SkeletonCard className="min-h-[4.5rem]" />
              <SkeletonCard className="min-h-[4.5rem]" />
            </div>
            <SkeletonCard className="min-h-[1.25rem]" />
          </div>
          <div className="flex flex-col gap-5">
            <SkeletonCard className="min-h-[20rem]" />
            {settings.enabledPrograms.length > 1 && (
              <SkeletonCard className="min-h-[20rem]" />
            )}
          </div>
        </>
      ) : (
        <>
          <HomeSummary
            summary={home.summary}
            weeklyRecap={home.weeklyRecap}
          />

          <div
            className={
              installVisible === true || showTip
                ? 'mb-4 min-h-[13.5rem]'
                : undefined
            }
          >
            <InstallCoach demotePrimary onVisibilityChange={onInstallVisibility} />

            {showTip && home.tip && (
              <HomeTip
                tip={home.tip}
                onDismiss={(id) => {
                  dismissHomeTip(id, localDayKey())
                  if (home.tip?.kind === 'login_backup') {
                    setDismissedLoginBackupTip(true)
                  }
                }}
                onAction={(program) => {
                  if (home.tip?.kind === 'dual_program' && home.tip.actionProgram) {
                    navigate(`/setup/test/${home.tip.actionProgram}`)
                    return
                  }
                  void beginLevelChange(navigate, program)
                }}
                onNavigate={(path) => navigate(path, { state: { returnTo: '/' } })}
                onScroll={scrollToProgram}
              />
            )}
          </div>

          {settings.enabledPrograms.length === 0 ? (
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.noProgramsTitle}
              description={pl.noProgramsDesc}
              action={{ label: pl.goToProfile, onClick: () => navigate('/profile') }}
            />
          ) : (
            <section aria-label={canChooseTraining ? pl.homeChooseTraining : pl.homeYourPrograms}>
              <h2 className="sr-text-h2 text-[var(--sr-text-primary)]">
                {canChooseTraining ? pl.homeChooseTraining : pl.homeYourPrograms}
              </h2>
              {canChooseTraining && (
                <p className="mt-1 mb-4 text-sm text-[var(--sr-text-secondary)]">
                  {pl.homeChooseTrainingHint}
                </p>
              )}
              {!canChooseTraining && <div className="mb-4" />}
              <div className="flex flex-col gap-5">
                {home.cards.map((card) => (
                  <ProgramHomeCard
                    key={`${card.program}-${reloadEpoch}`}
                    model={card}
                    allResting={home.summary.allResting}
                    tipSuppression={
                      showTip
                        ? home.tipSuppression
                        : { stale: false, test: false, level: false }
                    }
                    onReload={reload}
                  />
                ))}
              </div>
              {settings.enabledPrograms.length === 1 && (
                <Button
                  variant="ghost"
                  fullWidth
                  className="mt-4"
                  onClick={() => navigate('/profile')}
                >
                  {pl.homeAddSecondProgram}
                </Button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
