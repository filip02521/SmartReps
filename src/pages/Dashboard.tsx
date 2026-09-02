import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogoFull, LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { PageLoader, SkeletonCard, EmptyState, ErrorBanner } from '@/components/ux/Feedback'
import {
  HomeStatusHeader,
  HomeActivitySection,
} from '@/components/dashboard/HomeSummary'
import { HomeTip } from '@/components/dashboard/HomeTip'
import { ProgramHomeCard } from '@/components/dashboard/ProgramHomeCard'
import { CustomPlansHomeSection } from '@/components/dashboard/CustomPlansHomeSection'
import { InstallCoach } from '@/components/ux/InstallCoach'
import { pl } from '@/i18n/pl'
import { TAB_PAGE_SHELL } from '@/lib/ui-chrome'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { beginLevelChange } from '@/lib/setup-flow'
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
  const dismissedHabitMetTip = useAppStore((s) => s.dismissedHabitMetTip)
  const hasSeenLoginCloudPrompt = useAppStore((s) => s.hasSeenLoginCloudPrompt)
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const dismissHomeTip = useAppStore((s) => s.dismissHomeTip)
  const setDismissedLoginBackupTip = useAppStore((s) => s.setDismissedLoginBackupTip)
  const setDismissedHabitMetTip = useAppStore((s) => s.setDismissedHabitMetTip)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const hydrated = useStoreHydrated()
  const [reloadEpoch, setReloadEpoch] = useState(0)
  const [home, setHome] = useState<HomeLoadResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  /** null = InstallCoach not yet reported — tip withheld to avoid dual attention. */
  const [installVisible, setInstallVisible] = useState<boolean | null>(null)

  const onInstallVisibility = useCallback((v: boolean) => {
    setInstallVisible(v)
  }, [])

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
    setLoadError(null)
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
      dismissedHabitMetTip,
    })
      .then((result) => {
        if (!cancelled) {
          setHome(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHome(null)
          setLoadError(pl.errorLoadHome)
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
    lastSyncedAt,
    dismissedHomeTipId,
    dismissedHomeTipDay,
    installVisible,
    hasCompletedFirstWorkout,
    dismissedLoginBackupTip,
    dismissedHabitMetTip,
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
      <div className={TAB_PAGE_SHELL}>
        <PageLoader />
      </div>
    )
  }

  const reload = () => setReloadEpoch((n) => n + 1)
  const showTip = installVisible === false && !!home?.tip
  const showAttention = installVisible === true || showTip
  const tipSuppression = home?.tip
    ? home.tipSuppression
    : { stale: false, test: false, level: false }

  return (
    <div className={TAB_PAGE_SHELL}>
      <header className="mb-5">
        <LogoFull height={36} />
        <h1 className="sr-only">{pl.navWorkout}</h1>
      </header>

      {loadError && (
        <ErrorBanner
          message={loadError}
          onRetry={() => {
            setLoadError(null)
            reload()
          }}
        />
      )}

      {loading && !home ? (
        <>
          <div className="mb-5 space-y-3" aria-busy aria-label={pl.loading}>
            <SkeletonCard className="min-h-[3.5rem]" />
            <SkeletonCard className="min-h-[20rem]" />
          </div>
        </>
      ) : home ? (
        <>
          <HomeStatusHeader summary={home.summary} />

          <div className={showAttention ? 'mb-4' : undefined}>
            <InstallCoach demotePrimary onVisibilityChange={onInstallVisibility} />

            {showTip && home.tip && (
              <HomeTip
                tip={home.tip}
                onDismiss={(id) => {
                  dismissHomeTip(id, localDayKey())
                  if (home.tip?.kind === 'login_backup') {
                    setDismissedLoginBackupTip(true)
                  }
                  if (home.tip?.kind === 'habit_met') {
                    setDismissedHabitMetTip(true)
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
              action={{
                label: pl.noProgramsCreatePlan,
                onClick: () => navigate('/plans?tab=mine'),
              }}
              secondaryAction={{
                label: pl.noProgramsGoProfile,
                onClick: () => navigate('/profile'),
              }}
            />
          ) : (
            <section aria-label={pl.homeStartTraining}>
              <h2 className="sr-text-h2 text-[var(--sr-text-primary)]">{pl.homeStartTraining}</h2>
              <p className="mt-1 mb-4 sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.homeChooseTrainingHint}
              </p>
              <div className="flex flex-col gap-5">
                {home.cards.map((card) => (
                  <ProgramHomeCard
                    key={`${card.program}-${reloadEpoch}`}
                    model={card}
                    allResting={home.summary.allResting}
                    tipSuppression={tipSuppression}
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
              <CustomPlansHomeSection embedded />
            </section>
          )}

          {/* Cards only when custom-only — EmptyState above already owns create CTAs */}
          {settings.enabledPrograms.length === 0 && (
            <CustomPlansHomeSection hideEmptyDiscover />
          )}

          <HomeActivitySection summary={home.summary} />
        </>
      ) : null}
    </div>
  )
}
