import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { LogoFull } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageLoader, SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { HomeStatusHeader } from '@/components/dashboard/HomeSummary'
import { StreakFlame } from '@/components/dashboard/StreakFlame'
import { HomeTip } from '@/components/dashboard/HomeTip'
import { HomeTrainingSection } from '@/components/dashboard/HomeTrainingSection'
import { HomeActivityCard } from '@/components/dashboard/HomeActivityCard'
import { StreakDetailSheet } from '@/components/dashboard/StreakDetailSheet'
import { CommunityHomeTeaser } from '@/components/dashboard/CommunityHomeTeaser'
import { WeeklyChallengeCard } from '@/components/dashboard/WeeklyChallengeCard'
import { InstallCoach } from '@/components/ux/InstallCoach'
import { WeeklyReportCard, WeeklyReportSkeleton } from '@/components/dashboard/WeeklyReportCard'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { pl } from '@/i18n/pl'
import { showToast } from '@/stores/toast-store'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { TAB_PAGE_SHELL } from '@/lib/ui-chrome'
import {
  Activity,
  ChevronRight,
  Loader2,
  Users,
} from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { beginLevelChange } from '@/lib/setup-flow'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { db, type LocalAiInsight, type LocalWorkoutSession } from '@/lib/db'
import { deleteAiInsight, enqueueSync, refreshSubscriptionStatus } from '@/lib/sync'
import { track, AnalyticsEvents } from '@/lib/analytics'
import { generateWeeklyReport } from '@/lib/ai/proactive-coach'
import { canUseManagedAi, resolveAiContextForCall } from '@/lib/ai/managed-client'
import { trackTrialExpiryIfNeeded, useProFeatures } from '@/lib/subscription'
import { ProTeaser } from '@/components/ux/ProTeaser'
import {
  checkRateLimit,
  acquireInflight,
  releaseInflight,
  recordCall,
  recordFailedCall,
  formatCooldownRemaining,
} from '@/lib/ai/rate-limiter'
import { listExercises } from '@/lib/custom-plan-service'
import { computeStreakWeeks, daysLeftInStreakWeek, getWeekKey, startOfLocalWeek } from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import { maintainStreakFreezes, useFrozenWeeks } from '@/lib/streak-freeze'
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
  useSeo({ title: pl.seoDashboardTitle, description: pl.seoDashboardDescription, path: '/' })
  const hasCompletedFirstWorkout = useAppStore((s) => s.hasCompletedFirstWorkout)
  const dismissedLoginBackupTip = useAppStore((s) => s.dismissedLoginBackupTip)
  const dismissedHabitMetTip = useAppStore((s) => s.dismissedHabitMetTip)
  const welcomeCardDismissed = useAppStore((s) => s.welcomeCardDismissed)
  const hasSeenLoginCloudPrompt = useAppStore((s) => s.hasSeenLoginCloudPrompt)
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const syncInFlight = useAppStore((s) => s.syncInFlight)
  const dismissHomeTip = useAppStore((s) => s.dismissHomeTip)
  const setWelcomeCardDismissed = useAppStore((s) => s.setWelcomeCardDismissed)
  const setDismissedLoginBackupTip = useAppStore((s) => s.setDismissedLoginBackupTip)
  const setDismissedHabitMetTip = useAppStore((s) => s.setDismissedHabitMetTip)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const hydrated = useStoreHydrated()
  const [reloadEpoch, setReloadEpoch] = useState(0)
  const [home, setHome] = useState<HomeLoadResult | null>(null)
  const [weeklyReport, setWeeklyReport] = useState<LocalAiInsight | null>(null)
  const [weeklyReportGenerating, setWeeklyReportGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [heatmapSessions, setHeatmapSessions] = useState<LocalWorkoutSession[]>([])
  const pro = useProFeatures()
  const [showProTeaser, setShowProTeaser] = useState(false)
  // Pro user can generate AI reports when hosted AI is reachable (logged-in
  // session) or a BYOK key is configured. Mirrors resolveAiContext() — kept
  // as a render-time check so the empty-state CTA can act directly.
  const weeklyAiReady =
    pro && (!!(settings.aiApiKey ?? '').trim() || canUseManagedAi(hasSession === true, pro))

  // Weekly-report CTA is state-aware — a Pro user must never land on a
  // dead-end "unlock Pro" card: coach off → settings, logged out → login,
  // AI ready → generate the report right now (force regenerates with AI).
  const handleWeeklyReportCta = () => {
    if (!pro) {
      setShowProTeaser(true)
      return
    }
    if (!settings.aiProactiveCoach) {
      navigate('/profile?settings=ai')
      return
    }
    if (!weeklyAiReady) {
      navigate(hasSession === false ? '/setup/login' : '/profile?settings=ai')
      return
    }
    setSearchParams({ weekly_report: 'force' }, { replace: true })
  }

  const weeklyReportHint = !pro
    ? pl.aiCoachProRequired
    : !settings.aiProactiveCoach
      ? pl.coachWeeklyReportDisabledHint
      : !weeklyAiReady
        ? hasSession === false
          ? pl.coachWeeklyReportLoginHint
          : pl.coachWeeklyReportConfigHint
        : pl.coachWeeklyReportConnectHintPro

  const weeklyReportCtaAria = !pro
    ? pl.aiUnlockPro
    : weeklyAiReady && settings.aiProactiveCoach
      ? pl.coachWeeklyReportGenerateAria
      : pl.coachWeeklyReportConnectCtaAria
  /** null = InstallCoach not yet reported — tip withheld to avoid dual attention. */
  const [installVisible, setInstallVisible] = useState<boolean | null>(null)

  const onInstallVisibility = useCallback((v: boolean) => {
    setInstallVisible(v)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    // Funnel: observe a lapsed trial (status stays 'trial' server-side until
    // flipped — the client-side check is the measurement point). Local-only,
    // so it also fires for offline/no-session usage.
    trackTrialExpiryIfNeeded()
    if (!isSupabaseConfigured) {
      setHasSession(false)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      // Heal a stale cached plan: a server-side grant (Stripe webhook, admin
      // change) since the last sync would otherwise leave the plan badge and
      // feature gating stuck on 'free' until the next full sync.
      if (data.session) void refreshSubscriptionStatus()
    })
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
      hasCompletedFirstWorkout,
      welcomeCardDismissed,
      enabledCustomPlanIds: settings.enabledCustomPlanIds,
      customPlansFilterExplicit: settings.customPlansFilterExplicit,
    })
      .then(async (result) => {
        if (!cancelled) {
          setHome(result)
          setLoading(false)
          // Load sessions for streak heatmap
          try {
            const sessions = await db.workoutSessions.toArray()
            if (!cancelled) setHeatmapSessions(sessions)
          } catch {
            /* ignore — heatmap is non-critical */
          }
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
    settings.enabledCustomPlanIds,
    settings.customPlansFilterExplicit,
    reloadEpoch,
    lastSyncedAt,
    dismissedHomeTipId,
    dismissedHomeTipDay,
    installVisible,
    hasCompletedFirstWorkout,
    dismissedLoginBackupTip,
    dismissedHabitMetTip,
    welcomeCardDismissed,
    hasSeenLoginCloudPrompt,
    hasSession,
  ])

  // Streak freeze maintenance — accrues this month's freeze (Pro) and
  // auto-rescues a broken streak. Both steps are idempotent; the toast only
  // fires when a freeze was actually consumed this run. Runs even with zero
  // sessions — the monthly grant must accrue before the first workout.
  useEffect(() => {
    if (!hydrated) return
    const completed = heatmapSessions.filter((s) => s.status === 'completed')
    void maintainStreakFreezes(completed)
      .then((saved) => {
        if (saved.length) {
          showToast(pl.streakFreezeSavedToast, 'success')
          track(AnalyticsEvents.streakFreezeUsed, { weeks: saved.length })
        }
      })
      .catch(() => {
        // Streak freezes are additive — a failure must never break the dashboard.
      })
  }, [hydrated, heatmapSessions])

  useEffect(() => {
    if (!hydrated || loading || !home) return
    const programParam = searchParams.get('program')
    if (programParam !== 'pushups' && programParam !== 'pullups' && programParam !== 'squats') return
    scrollToProgram(programParam)
    setSearchParams({}, { replace: true })
  }, [hydrated, loading, home, searchParams, setSearchParams])

  // Proactive coach: weekly report — generate on demand or on Sunday
  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    const controller = new AbortController()
    void (async () => {
      const now = new Date()
      const currentWeekKey = getWeekKey(now)
      const forceRegenerate = searchParams.get('weekly_report') === 'force'

      // ── Catch-up: check if previous week's report is missing ──
      // If the user didn't open the app on Sunday, the weekly report for last
      // week was never generated. On Monday–Saturday, we check if last week
      // had sessions but no report — if so, generate it as a catch-up.
      const prevWeekDate = new Date(now)
      prevWeekDate.setDate(now.getDate() - 7)
      const prevWeekKey = getWeekKey(prevWeekDate)
      const prevWeekStart = startOfLocalWeek(prevWeekDate)
      const prevWeekEnd = new Date(prevWeekStart)
      prevWeekEnd.setDate(prevWeekStart.getDate() + 7)
      const prevWeekSessions = await db.workoutSessions
        .filter((s) => s.status === 'completed' && new Date(s.startedAt) >= prevWeekStart && new Date(s.startedAt) < prevWeekEnd)
        .count()
      const prevWeekExisting = await db.aiInsights
        .where('weekKey')
        .equals(prevWeekKey)
        .filter((i) => i.type === 'weekly_report')
        .count()
      const needsCatchUp = prevWeekSessions > 0 && prevWeekExisting === 0

      // ── Check current week for existing report ──
      // Check for ANY existing report this week (including dismissed).
      // If any exists (even dismissed), don't regenerate — respect user's dismissal.
      // Exception: ?weekly_report=force bypasses cache (for testing/fixing stale reports).
      let currentWeekHasReport = false
      if (!forceRegenerate) {
        const allExisting = await db.aiInsights
          .where('weekKey')
          .equals(currentWeekKey)
          .filter((i) => i.type === 'weekly_report')
          .toArray()
        if (allExisting.length > 0) {
          currentWeekHasReport = true
          // Prefer AI source, then most recent createdAt
          const best = allExisting.sort((a, b) => {
            if (a.source === 'ai' && b.source !== 'ai') return -1
            if (a.source !== 'ai' && b.source === 'ai') return 1
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })[0]
          // Clean up duplicate reports for the same week (keep only the best).
          // Tombstoned deletes — prevents resurrection from other devices.
          if (allExisting.length > 1) {
            const duplicates = allExisting.filter((r) => r.id !== best.id)
            for (const dup of duplicates) {
              await deleteAiInsight(dup)
            }
          }
          if (!cancelled && !best.dismissedAt) setWeeklyReport(best)
          // Even if current week has a report, still do catch-up for prev week
          if (!needsCatchUp) return
          // Fall through to catch-up generation below
        }
      }

      // ── Determine which week to generate for ──
      // Priority: force param → current week; catch-up → previous week; else current week
      const isForce = forceRegenerate
      const isCatchUp = !isForce && needsCatchUp
      const targetWeekDate = isCatchUp ? prevWeekDate : now
      const targetWeekKey = getWeekKey(targetWeekDate)

      // For catch-up: if a report already exists for prev week (race), skip
      if (isCatchUp) {
        const recheck = await db.aiInsights
          .where('weekKey')
          .equals(targetWeekKey)
          .filter((i) => i.type === 'weekly_report')
          .count()
        if (recheck > 0) return
      }

      // Check if user has any completed sessions in the target week
      const targetWeekStart = startOfLocalWeek(targetWeekDate)
      const targetWeekEnd = new Date(targetWeekStart)
      targetWeekEnd.setDate(targetWeekStart.getDate() + 7)
      const targetWeekSessions = await db.workoutSessions
        .filter((s) => s.status === 'completed' && new Date(s.startedAt) >= targetWeekStart && new Date(s.startedAt) < targetWeekEnd)
        .count()
      if (!isForce && targetWeekSessions === 0) return

      // Generation starts here — show placeholder until report is ready
      setWeeklyReportGenerating(true)

      const settings = useAppStore.getState().settings
      const aiConfig = settings.aiProactiveCoach
        ? await resolveAiContextForCall(settings)
        : undefined

      // Rate limit check — only for AI calls (local fallback is free)
      if (aiConfig) {
        const rl = checkRateLimit('weekly_report')
        if (!rl.allowed) {
          // For auto-fire: silently use local fallback
          // For force: show error via local fallback
          if (forceRegenerate && rl.reason === 'cooldown') {
            showToast(pl.aiRateLimitCooldown(formatCooldownRemaining(rl.retryAfterMs)), 'warning')
          }
          // Generate local report instead
          try {
            const [sessions, exercises] = await Promise.all([
              db.workoutSessions.toArray(),
              listExercises(),
            ])
            const report = await generateWeeklyReport({ sessions, exercises, aiConfig: undefined, signal: controller.signal, weekDate: targetWeekDate })
            if (cancelled) { setWeeklyReportGenerating(false); return }
            if (forceRegenerate) {
              const old = await db.aiInsights.where('weekKey').equals(targetWeekKey).filter((i) => i.type === 'weekly_report').toArray()
              for (const r of old) await deleteAiInsight(r)
            }
            await db.aiInsights.put(report)
            void enqueueSync('ai_insights', 'insert', report)
            // Re-evaluate achievements — ai_first_insight / ai_coach_user count AI insights
            if (report.source === 'ai') {
              void import('@/lib/achievements/schedule').then((m) => m.scheduleAchievementCheck())
            }
            // For catch-up: only show if current week has no report of its own.
            // If current week already has a report, the catch-up runs silently
            // in the background (the current week's report stays displayed).
            if (!isCatchUp || !currentWeekHasReport) setWeeklyReport(report)
            setWeeklyReportGenerating(false)
            if (forceRegenerate) {
              const next = new URLSearchParams(searchParams)
              next.delete('weekly_report')
              setSearchParams(next, { replace: true })
            }
          } catch {
            setWeeklyReportGenerating(false)
            // Non-blocking
          }
          return
        }
        acquireInflight('weekly_report')
      }

      try {
        const [sessions, exercises] = await Promise.all([
          db.workoutSessions.toArray(),
          listExercises(),
        ])
        const report = await generateWeeklyReport({ sessions, exercises, aiConfig, signal: controller.signal, weekDate: targetWeekDate })
        if (cancelled) { setWeeklyReportGenerating(false); return }
        // Record successful AI call
        if (report.source === 'ai') {
          recordCall('weekly_report')
        }
        // When forcing with AI configured, don't overwrite AI report with local fallback
        if (forceRegenerate && aiConfig && report.source !== 'ai') {
          // AI failed — count toward quota to prevent retry spam
          recordFailedCall('weekly_report')
          // AI failed — keep existing report if any, don't save local fallback
          const existing = await db.aiInsights
            .where('weekKey')
            .equals(targetWeekKey)
            .filter((i) => i.type === 'weekly_report' && !i.dismissedAt)
            .first()
          if (existing) {
            setWeeklyReport(existing)
          } else {
            // No existing report — save local as last resort
            await db.aiInsights.put(report)
            void enqueueSync('ai_insights', 'insert', report)
            setWeeklyReport(report)
          }
          const next = new URLSearchParams(searchParams)
          next.delete('weekly_report')
          setSearchParams(next, { replace: true })
          return
        }
        // When forcing, delete old reports for this week first
        if (forceRegenerate) {
          const old = await db.aiInsights
            .where('weekKey')
            .equals(targetWeekKey)
            .filter((i) => i.type === 'weekly_report')
            .toArray()
          for (const r of old) await deleteAiInsight(r)
        }
        await db.aiInsights.put(report)
        void enqueueSync('ai_insights', 'insert', report)
        // Re-evaluate achievements — ai_first_insight / ai_coach_user count AI insights
        if (report.source === 'ai') {
          void import('@/lib/achievements/schedule').then((m) => m.scheduleAchievementCheck())
        }
        // For catch-up: only show if current week has no report of its own.
        // If current week already has a report, the catch-up runs silently
        // in the background (the current week's report stays displayed).
        if (!isCatchUp || !currentWeekHasReport) setWeeklyReport(report)
        // Clear force param after report is saved so re-entry doesn't regenerate
        if (forceRegenerate) {
          const next = new URLSearchParams(searchParams)
          next.delete('weekly_report')
          setSearchParams(next, { replace: true })
        }
      } catch {
        // AI call failed (not aborted) — count toward quota to prevent retry spam
        if (aiConfig) recordFailedCall('weekly_report')
        setWeeklyReportGenerating(false)
        // Non-blocking
      } finally {
        setWeeklyReportGenerating(false)
        if (aiConfig) releaseInflight('weekly_report')
      }
    })()
    return () => { cancelled = true; controller.abort() }
  // `pro` in deps: a mid-session upgrade (status pulled during this app
  // run) must re-resolve the AI context instead of staying on the cached
  // free-tier path until the next mount.
  }, [hydrated, hasCompletedFirstWorkout, reloadEpoch, searchParams, setSearchParams, pro])

  // Streak chip in the top bar — same numbers as the activity card below,
  // opens the detail sheet directly.
  const frozenWeeks = useFrozenWeeks()
  const completedSessions = useMemo(
    () => heatmapSessions.filter((s) => s.status === 'completed'),
    [heatmapSessions],
  )
  const streak = useMemo(
    () => computeStreakWeeks(completedSessions, new Date(), frozenWeeks),
    [completedSessions, frozenWeeks],
  )
  const streakAtRisk = useMemo(() => {
    if (streak === 0) return false
    const weekKey = getWeekKey(new Date())
    return !completedSessions.some(
      (s) => getWeekKey(new Date(s.startedAt)) === weekKey,
    )
  }, [streak, completedSessions])
  const bestStreak = useMemo(
    () => computeBestStreakWeeks(completedSessions, frozenWeeks),
    [completedSessions, frozenWeeks],
  )
  const [streakSheetOpen, setStreakSheetOpen] = useState(false)

  if (!hydrated) {
    return (
      <div className={TAB_PAGE_SHELL}>
        <PageLoader />
      </div>
    )
  }

  const reload = () => setReloadEpoch((n) => n + 1)
  // Fresh-device login: local Dexie is empty and the first cloud pull is still
  // running — show a "restoring" state instead of the new-user UI so the user
  // doesn't see a wrong "no data / choose program" screen before sync lands.
  const waitingForFirstSync =
    hasSession === true && lastSyncedAt === null && syncInFlight
  const showTip = installVisible === false && !!home?.tip
  const tipSuppression = home?.tip
    ? home.tipSuppression
    : { stale: false, test: false, level: false }

  return (
    <div className={TAB_PAGE_SHELL}>
      <header className="mb-5 flex items-center justify-between gap-3">
        {/* Tonal lockup in app chrome — gradient lockup lives in brand
            moments (splash, login, onboarding). */}
        <LogoFull height={34} tone="tonal" />
        {completedSessions.length > 0 && (
          <button
            type="button"
            onClick={() => setStreakSheetOpen(true)}
            aria-label={
              streakAtRisk
                ? pl.streakChainAriaRisk(
                    streak,
                    bestStreak,
                    daysLeftInStreakWeek(),
                  )
                : pl.streakChainAria(streak, bestStreak)
            }
            className={cn(
              FOCUS_RING,
              'flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-3 py-1.5 transition-colors hover:bg-[var(--sr-bg-surface)]',
              streakAtRisk && 'sr-risk-pulse',
            )}
          >
            <StreakFlame streak={streak} size={15} dying={streakAtRisk} />
            <span className="sr-text-caption font-semibold tabular-nums text-[var(--sr-text-primary)]">
              {streak}
            </span>
            {streakAtRisk && (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--sr-warning)_15%,transparent)] px-1.5 py-0.5 sr-text-caption font-bold tabular-nums leading-none text-[var(--sr-warning)]">
                {pl.streakDaysShort(daysLeftInStreakWeek())}
              </span>
            )}
          </button>
        )}
        <h1 className="sr-only">{pl.navWorkout}</h1>
      </header>

      {loadError && (
        <div className="space-y-3">
          <ErrorBanner
            message={loadError}
            onRetry={() => {
              setLoadError(null)
              reload()
            }}
          />
          <Button variant="ghost" fullWidth onClick={() => navigate('/', { replace: true })}>
            {pl.backHome}
          </Button>
        </div>
      )}

      {loading && !home ? (
        <div className="space-y-6" aria-busy aria-label={pl.loading}>
          {/* Status header skeleton */}
          <SkeletonCard className="min-h-[6rem]" />
          {/* Training hero + option rows skeleton */}
          <SkeletonCard className="min-h-[14rem]" />
          <SkeletonCard className="min-h-[10rem]" />
          {/* Activity card skeleton */}
          <SkeletonCard className="min-h-[12rem]" />
          {/* AI report skeleton */}
          <SkeletonCard className="min-h-[8rem]" />
          {/* Community skeleton */}
          <SkeletonCard className="min-h-[8rem]" />
        </div>
      ) : waitingForFirstSync ? (
        <div className="space-y-6" aria-busy aria-label={pl.homeSyncingData}>
          <div
            role="status"
            className="flex items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-4 py-3 shadow-[var(--sr-shadow-card)]"
          >
            <Loader2
              size={18}
              className="shrink-0 animate-spin text-[var(--sr-brand-primary)]"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--sr-text-primary)]">
                {pl.homeSyncingData}
              </p>
              <p className="text-xs leading-snug text-[var(--sr-text-secondary)]">
                {pl.homeSyncingDataHint}
              </p>
            </div>
          </div>
          <SkeletonCard className="min-h-[8rem]" />
          <SkeletonCard className="min-h-[14rem]" />
          <SkeletonCard className="min-h-[10rem]" />
        </div>
      ) : home ? (
        <>
          {/* 1. Hero status — date + greeting + contextual headline.
              The primary action lives in the training hero below — one CTA,
              not three competing ones. */}
          <HomeStatusHeader
            summary={home.summary}
            displayName={settings.displayName || undefined}
          />

          {/* 2. Attention band — InstallCoach XOR HomeTip (per UX wireframe) */}
          <div className="mt-5">
            <InstallCoach demotePrimary onVisibilityChange={onInstallVisibility} />

            {showTip && home.tip && (
              <HomeTip
                tip={home.tip}
                onDismiss={(id) => {
                  dismissHomeTip(id, localDayKey())
                  if (home.tip?.kind === 'welcome') {
                    setWelcomeCardDismissed(true)
                  }
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

          {/* 3. Training — one hero card (the resolved next action across
              builtin programs, custom plans and free workout) plus uniform
              compact rows for every other way to train. */}
          <HomeTrainingSection
            home={home}
            tipSuppression={tipSuppression}
            onReload={reload}
            streak={streak}
            streakAtRisk={streakAtRisk}
          />

          {/* 4. Twoja aktywność — streak + 12-week chain + 14-day metrics +
              trend in a single cohesive card. */}
          <section aria-label={pl.homeActivitySectionAria} className="mt-6">
            <SectionHeader icon={Activity} title={pl.homeActivityTitle} />
            <HomeActivityCard summary={home.summary} sessions={heatmapSessions} />
          </section>

          {/* 5. Proactive coach: weekly report card + CTA gdy AI brak */}
          <section aria-label={pl.coachWeeklyReportSectionAria} className="mt-6">
            <SectionHeader title={pl.coachWeeklyReportTitle} />
            {weeklyReportGenerating && !weeklyReport && <WeeklyReportSkeleton />}
            {weeklyReport && !weeklyReport.dismissedAt && (
              <WeeklyReportCard
                // Keyed by week (not insight.id) — regenerating produces a new
                // id every time, which would otherwise remount the card and
                // silently collapse it right after the user asked to refresh it.
                key={weeklyReport.weekKey ?? weeklyReport.id}
                insight={weeklyReport}
                onDismissed={() => setWeeklyReport(null)}
                onConnectAi={handleWeeklyReportCta}
                connectLabel={pro ? pl.coachWeeklyReportUpgradeAi : undefined}
                onRegenerate={() => setSearchParams({ weekly_report: 'force' }, { replace: true })}
                regenerating={weeklyReportGenerating}
              />
            )}
            {!weeklyReportGenerating && !weeklyReport && (
              <button
                type="button"
                onClick={handleWeeklyReportCta}
                className={cn(
                  FOCUS_RING,
                  'flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4 text-left transition-colors hover:bg-[var(--sr-bg-surface)]',
                )}
                aria-label={weeklyReportCtaAria}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[color-mix(in_srgb,var(--sr-brand-primary)_12%,transparent)] text-[var(--sr-brand-primary)]"
                  aria-hidden
                >
                  <AiCoachMark size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
                    {pl.coachWeeklyReportConnectTitle}
                  </p>
                  <p className="mt-0.5 sr-text-caption text-[var(--sr-text-muted)]">
                    {weeklyReportHint}
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  aria-hidden
                  className="shrink-0 text-[var(--sr-text-muted)]"
                />
              </button>
            )}

            <ProTeaser
              open={showProTeaser}
              onClose={() => setShowProTeaser(false)}
              feature="hostedAi"
            />
          </section>

          {/* 6. Społeczność — weekly challenge + community teaser together
              at the bottom (social zone, not mixed into personal stats). */}
          <section aria-label={pl.homeCommunitySectionAria} className="mt-6">
            <SectionHeader icon={Users} title={pl.homeCommunityTitle} />
            <WeeklyChallengeCard />
            <div className="mt-3">
              <CommunityHomeTeaser />
            </div>
          </section>

          <StreakDetailSheet
            open={streakSheetOpen}
            onClose={() => setStreakSheetOpen(false)}
            sessions={heatmapSessions}
          />
        </>
      ) : null}
    </div>
  )
}
