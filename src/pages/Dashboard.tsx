import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { LogoFull, LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageLoader, SkeletonCard, EmptyState, ErrorBanner } from '@/components/ux/Feedback'
import {
  HomeStatusHeader,
  HomeActivitySection,
} from '@/components/dashboard/HomeSummary'
import { HomeTip } from '@/components/dashboard/HomeTip'
import { ProgramHomeCard } from '@/components/dashboard/ProgramHomeCard'
import { CustomPlansHomeSection } from '@/components/dashboard/CustomPlansHomeSection'
import { CommunityHomeTeaser } from '@/components/dashboard/CommunityHomeTeaser'
import { WeeklyChallengeCard } from '@/components/dashboard/WeeklyChallengeCard'
import { StreakChainCard } from '@/components/dashboard/StreakChainCard'
import { InstallCoach } from '@/components/ux/InstallCoach'
import { WeeklyReportCard } from '@/components/dashboard/WeeklyReportCard'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { pl } from '@/i18n/pl'
import { showToast } from '@/stores/toast-store'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { TAB_PAGE_SHELL } from '@/lib/ui-chrome'
import { Dumbbell, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { beginLevelChange, beginProgramSetup } from '@/lib/setup-flow'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { db, type LocalAiInsight, type LocalWorkoutSession } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { track, AnalyticsEvents } from '@/lib/analytics'
import { generateWeeklyReport } from '@/lib/ai/proactive-coach'
import {
  checkRateLimit,
  acquireInflight,
  releaseInflight,
  recordCall,
  recordFailedCall,
  formatCooldownRemaining,
} from '@/lib/ai/rate-limiter'
import { listExercises } from '@/lib/custom-plan-service'
import { getWeekKey, startOfLocalWeek } from '@/lib/stats-engine'
import {
  loadHomeDashboard,
  localDayKey,
  type HomeLoadResult,
  type QuickCta,
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
      hasCompletedFirstWorkout,
      welcomeCardDismissed,
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

  useEffect(() => {
    if (!hydrated || loading || !home) return
    const programParam = searchParams.get('program')
    if (programParam !== 'pushups' && programParam !== 'pullups') return
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
          // Clean up duplicate reports for the same week (keep only the best)
          if (allExisting.length > 1) {
            const duplicates = allExisting.filter((r) => r.id !== best.id)
            await Promise.all(duplicates.map((r) => db.aiInsights.delete(r.id)))
            // Enqueue sync deletes so duplicates are removed from cloud too
            // (prevents resurrection from other devices)
            for (const dup of duplicates) {
              void enqueueSync('ai_insights', 'delete', dup)
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
      const aiConfig = settings.aiProactiveCoach && settings.aiApiKey
        ? { apiKey: settings.aiApiKey, model: settings.aiModel ?? 'gpt-4o-mini', baseURL: settings.aiBaseUrl || undefined, reasoningEffort: settings.aiReasoningEffort }
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
              await Promise.all(old.map((r) => db.aiInsights.delete(r.id)))
              for (const r of old) void enqueueSync('ai_insights', 'delete', r)
            }
            await db.aiInsights.put(report)
            void enqueueSync('ai_insights', 'insert', report)
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
          await Promise.all(old.map((r) => db.aiInsights.delete(r.id)))
          for (const r of old) void enqueueSync('ai_insights', 'delete', r)
        }
        await db.aiInsights.put(report)
        void enqueueSync('ai_insights', 'insert', report)
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
  }, [hydrated, hasCompletedFirstWorkout, reloadEpoch, searchParams, setSearchParams])

  const handleQuickCta = useCallback((cta: QuickCta) => {
    switch (cta.kind) {
      case 'workout':
        if (!hasCompletedFirstWorkout) {
          track(AnalyticsEvents.firstWorkoutStarted, { program: cta.program, type: 'builtin' })
        }
        navigate(`/workout/${cta.program}`)
        break
      case 'workout-force':
        if (!hasCompletedFirstWorkout) {
          track(AnalyticsEvents.firstWorkoutStarted, { program: cta.program, type: 'builtin' })
        }
        navigate(`/workout/${cta.program}?force=1`)
        break
      case 'setup':
        void beginProgramSetup(navigate, cta.program)
        break
      case 'scroll':
        scrollToProgram(cta.program)
        break
    }
  }, [navigate, hasCompletedFirstWorkout])

  if (!hydrated) {
    return (
      <div className={TAB_PAGE_SHELL}>
        <PageLoader />
      </div>
    )
  }

  const reload = () => setReloadEpoch((n) => n + 1)
  const showTip = installVisible === false && !!home?.tip
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
          {/* Status header skeleton (with quick CTA) */}
          <SkeletonCard className="min-h-[8rem]" />
          {/* Training cards skeleton */}
          <SkeletonCard className="min-h-[14rem]" />
          <SkeletonCard className="min-h-[14rem]" />
          {/* Motivation section skeleton (challenge + streak) */}
          <SkeletonCard className="min-h-[10rem]" />
          {/* Activity metrics skeleton */}
          <SkeletonCard className="min-h-[6rem]" />
          {/* AI report skeleton */}
          <SkeletonCard className="min-h-[8rem]" />
          {/* Community skeleton */}
          <SkeletonCard className="min-h-[8rem]" />
        </div>
      ) : home ? (
        <>
          {/* 1. Hero status — date + greeting + contextual headline + quick CTA */}
          <HomeStatusHeader
            summary={home.summary}
            displayName={settings.displayName || undefined}
            onQuickCta={handleQuickCta}
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

          {/* 3. Training cards — primary action, no scroll needed */}
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
                label: pl.noProgramsEnableProgram,
                onClick: () => navigate('/plans?tab=programs'),
              }}
            />
          ) : (
            <section aria-label={pl.homeStartTraining} className="mt-6">
              <SectionHeader icon={Dumbbell} title={pl.homeStartTraining} />
              <div className="flex flex-col gap-3">
                <CustomPlansHomeSection embedded />
                {home.cards.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="sr-text-body-sm font-semibold text-[var(--sr-text-secondary)]">
                      {pl.programs}
                    </h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate('/plans?tab=programs')}
                    >
                      {pl.homeSeeAllCustom}
                    </Button>
                  </div>
                )}
                {home.cards.map((card) => (
                  <ProgramHomeCard
                    key={card.program}
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
                  onClick={() => navigate('/plans?tab=programs')}
                >
                  {pl.homeAddSecondProgram}
                </Button>
              )}
            </section>
          )}

          {/* Cards only when custom-only — EmptyState above already owns create CTAs */}
          {settings.enabledPrograms.length === 0 && (
            <CustomPlansHomeSection hideEmptyDiscover />
          )}

          {/* 4. Motywacja tygodnia — wyzwanie + streak (skonsolidowane) */}
          <section aria-label={pl.homeMotivationSectionAria} className="mt-6">
            <SectionHeader title={pl.homeMotivationTitle} />
            <WeeklyChallengeCard />
            <StreakChainCard sessions={heatmapSessions} compact />
          </section>

          {/* 5. Activity metrics — retrospective, kompaktowe */}
          <div className="mt-6">
            <HomeActivitySection summary={home.summary} />
          </div>

          {/* 6. Proactive coach: weekly report card + CTA gdy AI brak */}
          <section aria-label={pl.coachWeeklyReportSectionAria} className="mt-6">
            <SectionHeader title={pl.coachWeeklyReportTitle} />
            {weeklyReportGenerating && !weeklyReport && (
              <div
                aria-busy
                aria-live="polite"
                className="sr-coach-msg-in overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] shadow-[var(--sr-shadow-card)]"
              >
                <div className="flex items-center gap-3 border-b border-[var(--sr-border-subtle)] bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_30%,transparent)] p-4">
                  <AiCoachMark size="sm" pulse />
                  <div className="min-w-0 flex-1">
                    <p className="animate-pulse text-xs text-[var(--sr-text-muted)]">
                      {pl.coachWeeklyReportGenerating}
                    </p>
                  </div>
                </div>
                {/* Skeleton metrics grid — mirrors the real 4-tile layout */}
                <div className="grid grid-cols-4 gap-2 p-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex h-14 animate-pulse flex-col items-center justify-center gap-1 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]"
                    >
                      <div className="h-3 w-8 rounded bg-[var(--sr-border-subtle)]" />
                      <div className="h-2 w-10 rounded bg-[var(--sr-border-subtle)]" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {weeklyReport && !weeklyReport.dismissedAt && (
              <WeeklyReportCard
                key={weeklyReport.id}
                insight={weeklyReport}
                onDismissed={() => setWeeklyReport(null)}
                onConnectAi={() => navigate('/profile')}
                onRegenerate={() => setSearchParams({ weekly_report: 'force' }, { replace: true })}
                regenerating={weeklyReportGenerating}
              />
            )}
            {!weeklyReportGenerating && !weeklyReport && (
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className={cn(
                  FOCUS_RING,
                  'flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4 text-left transition-colors hover:bg-[var(--sr-bg-surface)]',
                )}
                aria-label={pl.coachWeeklyReportConnectCtaAria}
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
                    {pl.coachWeeklyReportConnectHint}
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  aria-hidden
                  className="shrink-0 text-[var(--sr-text-muted)]"
                />
              </button>
            )}
          </section>

          {/* 7. Community — kompaktowe (1 karta + CTA) */}
          <CommunityHomeTeaser />
        </>
      ) : null}
    </div>
  )
}
