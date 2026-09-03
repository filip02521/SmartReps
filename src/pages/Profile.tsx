import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Settings, MoreVertical } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSection } from '@/components/ui/PageSection'
import { Switch } from '@/components/ui/Switch'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { Sheet } from '@/components/ui/Sheet'
import { SkeletonCard } from '@/components/ux/Feedback'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { ProfileAchievementsSection } from '@/components/achievements/ProfileAchievementsSection'
import { ProgramSettingsCard } from '@/components/profile/ProgramSettingsCard'
import { ImportBackupSheet } from '@/components/profile/ImportBackupSheet'
import { SettingsSheet } from '@/components/profile/SettingsSheet'
import { ProfileStats } from '@/components/profile/ProfileStats'
import { BodyWeightSection } from '@/components/progress/BodyWeightSection'
import { runAuthenticatedSync } from '@/lib/auth-sync'
import { signOutUser } from '@/lib/auth-lifecycle'
import { pl } from '@/i18n/pl'
import { FOCUS_RING, TAB_PAGE_SHELL } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'
import { requestWorkoutReminderPermission, scheduleDailyReminder, cancelReminder } from '@/lib/notifications'
import {
  getVapidPublicKey,
  isWebPushSupported,
  subscribeWebPush,
  unsubscribeWebPush,
  updatePushReminderHour,
} from '@/lib/web-push'
import { track } from '@/lib/analytics'
import { applyThemeColor } from '@/lib/theme-color'
import {
  getProgramProgress,
  reconcileActiveWorkout,
  setProgramPaused,
} from '@/lib/program-service'
import { beginLevelChange, beginProgramSetup } from '@/lib/setup-flow'
import { clearAllLocalData } from '@/lib/local-data'
import { exportSessionsCsv, exportCustomSessionsCsv, downloadCsv, mergeSessionCsvExports } from '@/lib/export'
import { exportBackupSnapshot, downloadBackupJson } from '@/lib/export-backup'
import { deleteRemoteAccount } from '@/lib/account-delete'
import { TextField } from '@/components/ui/TextField'
import { showToast } from '@/stores/toast-store'
import type { LocalProgramProgress } from '@/lib/db'
import type { Program } from '@/data/plans/types'

const appVersion = import.meta.env.VITE_APP_VERSION ?? '1.0.0'

function applyTheme(theme: 'system' | 'dark' | 'light') {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
  applyThemeColor(theme)
}

function applyHighContrast(on: boolean) {
  if (on) document.documentElement.setAttribute('data-high-contrast', 'true')
  else document.documentElement.removeAttribute('data-high-contrast')
}

export default function ProfilePage() {
  const { settings, setSettings } = useAppStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [pendingChangeLevel, setPendingChangeLevel] = useState<Program | null>(null)
  const [pendingRetest, setPendingRetest] = useState<Program | null>(null)
  const [pendingDisable, setPendingDisable] = useState<Program | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [showImportSheet, setShowImportSheet] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [customMenuPlanId, setCustomMenuPlanId] = useState<string | null>(null)
  const [progressByProgram, setProgressByProgram] = useState<Partial<Record<Program, LocalProgramProgress>>>({})
  const [programsReady, setProgramsReady] = useState(false)
  const [customActivePlans, setCustomActivePlans] = useState<
    { id: string; name: string; paused: boolean }[]
  >([])
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : null,
  )
  const remindersDenied =
    notifPermission === 'denied' ||
    (typeof Notification !== 'undefined' && Notification.permission === 'denied')

  const reloadMeta = async () => {
    const map: Partial<Record<Program, LocalProgramProgress>> = {}
    for (const p of settings.enabledPrograms) {
      const prog = await getProgramProgress(p)
      if (prog) map[p] = prog
    }
    setProgressByProgram(map)
    setProgramsReady(true)
    const { listCustomPlans } = await import('@/lib/custom-plan-service')
    const { db } = await import('@/lib/db')
    const plans = await listCustomPlans()
    const active: { id: string; name: string; paused: boolean }[] = []
    for (const p of plans.filter((plan) => plan.status === 'active')) {
      const prog = await db.customProgramProgress.where('customPlanId').equals(p.id).first()
      active.push({ id: p.id, name: p.name, paused: prog?.status === 'paused' })
    }
    setCustomActivePlans(active)
  }

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    applyTheme(settings.theme)
    applyHighContrast(settings.highContrast)
    void reloadMeta()

    if (!isSupabaseConfigured) return

    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme, settings.highContrast, settings.enabledPrograms])

  const handleSyncNow = async () => {
    if (!online || syncing) return
    setSyncing(true)
    try {
      await runAuthenticatedSync({ showSuccessToast: true, showFailureToast: true })
    } finally {
      setSyncing(false)
    }
  }

  const logoutOnly = async () => {
    try {
      await signOutUser()
      setEmail(null)
      setShowLogoutConfirm(false)
    } catch {
      showToast(pl.logoutFailed, 'error')
    }
  }

  const logoutAndClear = async () => {
    try {
      await signOutUser()
      await clearAllLocalData()
      setEmail(null)
      setShowLogoutConfirm(false)
      navigate('/setup/onboarding', { replace: true })
    } catch {
      showToast(pl.logoutFailed, 'error')
    }
  }

  const clearLocal = async () => {
    await clearAllLocalData()
    setShowClearConfirm(false)
    navigate('/setup/onboarding', { replace: true })
  }

  const exportJsonBackup = async () => {
    try {
      const snapshot = await exportBackupSnapshot()
      downloadBackupJson(snapshot)
      showToast(pl.toastExportDone, 'success')
    } catch {
      showToast(pl.exportFailed, 'error')
    }
  }

  const exportCsvBackup = async () => {
    try {
      const chunks: string[] = []
      for (const program of ['pushups', 'pullups'] as const) {
        chunks.push(await exportSessionsCsv(program))
      }
      chunks.push(await exportCustomSessionsCsv())
      const merged = mergeSessionCsvExports(chunks)
      downloadCsv(`smartreps-export-${new Date().toISOString().slice(0, 10)}.csv`, merged)
      showToast(pl.toastExportDone, 'success')
    } catch {
      showToast(pl.exportFailed, 'error')
    }
  }

  const deleteAccount = async () => {
    if (deleteConfirmText !== pl.deleteAccountConfirmWord) return
    setDeletingAccount(true)
    try {
      const result = await deleteRemoteAccount()
      if (!result.ok) {
        showToast(
          result.error === 'unauthorized' ? pl.deleteAccountSessionExpired : pl.deleteAccountFailed,
          'error',
        )
        return
      }
      await signOutUser()
      await clearAllLocalData()
      setShowDeleteConfirm(false)
      navigate('/setup/onboarding', { replace: true })
      showToast(pl.deleteAccountDone, 'success')
    } catch {
      showToast(pl.deleteAccountFailed, 'error')
    } finally {
      setDeletingAccount(false)
    }
  }

  const retest = async (program: Program) => {
    const active = await reconcileActiveWorkout(program)
    if (active) {
      setPendingRetest(program)
      return
    }
    await beginProgramSetup(navigate, program, { retest: true })
  }

  const confirmRetest = async () => {
    if (!pendingRetest) return
    const program = pendingRetest
    setPendingRetest(null)
    await beginProgramSetup(navigate, program, { retest: true })
  }

  const changeLevel = async (program: Program) => {
    const active = await reconcileActiveWorkout(program)
    if (active) {
      setPendingChangeLevel(program)
      return
    }
    await beginLevelChange(navigate, program)
  }

  const confirmChangeLevel = async () => {
    if (!pendingChangeLevel) return
    const program = pendingChangeLevel
    setPendingChangeLevel(null)
    await beginLevelChange(navigate, program)
  }

  const addProgram = (program: Program) => {
    if (settings.enabledPrograms.includes(program)) return
    setSettings({ enabledPrograms: [...settings.enabledPrograms, program] })
  }

  const disableProgram = (program: Program) => {
    const next = settings.enabledPrograms.filter((p) => p !== program)
    setSettings({ enabledPrograms: next })
    setPendingDisable(null)
  }

  const togglePause = async (program: Program) => {
    const prog = progressByProgram[program]
    if (!prog) return
    await setProgramPaused(program, prog.status !== 'paused')
    await reloadMeta()
  }

  const toggleCustomPlanPause = async (planId: string, paused: boolean) => {
    const { setCustomPlanPaused } = await import('@/lib/custom-plan-service')
    await setCustomPlanPaused(planId, !paused)
    await reloadMeta()
  }

  const missingPrograms = (['pushups', 'pullups'] as Program[]).filter(
    (p) => !settings.enabledPrograms.includes(p),
  )

  const showProgramsLoading =
    !programsReady &&
    Object.keys(progressByProgram).length === 0 &&
    settings.enabledPrograms.length > 0

  const pushDescription = !email
    ? pl.pushNeedsLogin
    : !isWebPushSupported() || !getVapidPublicKey()
      ? pl.pushUnavailable
      : pl.pushNotificationsHint

  const showReminderHour =
    settings.pushNotifications || (settings.workoutReminders && !settings.pushNotifications)

  const customMenuPlan = customActivePlans.find((p) => p.id === customMenuPlanId) ?? null

  const displayName = settings.displayName ?? ''
  const profileTitle = displayName || email || pl.navProfile

  return (
    <div className={TAB_PAGE_SHELL}>
      <PageHeader
        title={profileTitle}
        subtitle={email && displayName ? email : undefined}
        action={
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className={cn(
              FOCUS_RING,
              'flex min-h-11 min-w-11 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
            )}
            aria-label={pl.settingsTitle}
          >
            <Settings size={22} />
          </button>
        }
      />

      {/* Stats summary */}
      <ProfileStats />

      <BodyWeightSection />

      {/* Achievements */}
      <ProfileAchievementsSection />

      {/* Programs */}
      <PageSection title={pl.programs} className="mt-8">
        {showProgramsLoading ? (
          <div className="flex flex-col gap-4" aria-busy aria-label={pl.profileProgramsLoading}>
            <SkeletonCard className="min-h-[7rem]" />
            {settings.enabledPrograms.length > 1 && <SkeletonCard className="min-h-[7rem]" />}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {settings.enabledPrograms.length === 0 && (
              <p className="text-pretty sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.profileProgramsEmpty}
              </p>
            )}

            {settings.enabledPrograms.map((program) => (
              <ProgramSettingsCard
                key={program}
                program={program}
                progress={progressByProgram[program]}
                canDisable={true}
                onSetupOnTraining={() => navigate(`/?program=${program}`)}
                onChangeLevel={() => void changeLevel(program)}
                onRetest={() => void retest(program)}
                onTogglePause={() => void togglePause(program)}
                onDisable={() => setPendingDisable(program)}
              />
            ))}

            {missingPrograms.length > 0 && (
              <div className="rounded-[var(--sr-radius-md)] border border-dashed border-[var(--sr-border-strong)] bg-[var(--sr-bg-surface)]/60 px-3 py-3.5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
                  {pl.addProgram}
                </p>
                <div className="flex flex-col gap-2">
                  {missingPrograms.map((p) => (
                    <Button
                      key={p}
                      variant="secondary"
                      size="md"
                      fullWidth
                      className="justify-start px-4"
                      onClick={() => addProgram(p)}
                    >
                      {p === 'pushups' ? pl.addProgramPushups : pl.addProgramPullups}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {customActivePlans.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-sm font-medium text-[var(--sr-text-primary)]">
                  {pl.profileCustomPlansSubhead}
                </p>
                <p className="mb-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
                  {pl.activeWorkoutsHint}
                </p>
                <div className="flex flex-col gap-2.5">
                  {customActivePlans.map((plan) => {
                    const onTraining =
                      !settings.customPlansFilterExplicit ||
                      settings.enabledCustomPlanIds.includes(plan.id)
                    return (
                      <div
                        key={plan.id}
                        className="flex items-center gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={`custom-plan-${plan.id}`}
                            className="block cursor-pointer text-sm font-medium text-[var(--sr-text-primary)]"
                          >
                            {plan.name}
                          </label>
                          {plan.paused ? (
                            <span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">
                              {pl.planPaused}
                            </span>
                          ) : onTraining ? (
                            <span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">
                              {pl.profileCustomOnTraining}
                            </span>
                          ) : null}
                        </div>
                        <Switch
                          id={`custom-plan-${plan.id}`}
                          checked={onTraining}
                          onChange={(checked) => {
                            const current = settings.customPlansFilterExplicit
                              ? [...settings.enabledCustomPlanIds]
                              : customActivePlans.map((p) => p.id)
                            const next = checked
                              ? Array.from(new Set([...current, plan.id]))
                              : current.filter((id) => id !== plan.id)
                            setSettings({
                              customPlansFilterExplicit: true,
                              enabledCustomPlanIds: next,
                            })
                          }}
                          aria-label={plan.name}
                        />
                        <button
                          type="button"
                          className={cn(
                            'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-elevated)] hover:text-[var(--sr-text-primary)] active:scale-95',
                            FOCUS_RING,
                          )}
                          aria-label={pl.menuProgram}
                          onClick={() => setCustomMenuPlanId(plan.id)}
                        >
                          <MoreVertical size={20} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </PageSection>

      {/* About */}
      <PageSection title={pl.about} className="mt-8">
        <div className="flex flex-col gap-2 text-sm">
          <Link to="/privacy" className="text-[var(--sr-brand-primary)] underline-offset-4 hover:underline">
            {pl.privacyLink}
          </Link>
          <Link to="/terms" className="text-[var(--sr-brand-primary)] underline-offset-4 hover:underline">
            {pl.termsLink}
          </Link>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
          {pl.healthDisclaimer}
        </p>
        <p className="mt-3 text-xs text-[var(--sr-text-muted)]">
          <a
            href="https://100pompek.pl"
            className="text-[var(--sr-brand-primary)]"
            target="_blank"
            rel="noreferrer"
          >
            100pompek.pl
          </a>
          {' · '}
          <a
            href="https://podciaganie.pl"
            className="text-[var(--sr-brand-primary)]"
            target="_blank"
            rel="noreferrer"
          >
            podciaganie.pl
          </a>
        </p>
        <p className="mt-4 text-xs text-[var(--sr-text-muted)]">{pl.appVersion(appVersion)}</p>
      </PageSection>

      {/* Settings sheet — mounted only when needed */}
      {showSettings && (
      <SettingsSheet
        open={showSettings}
        onClose={() => setShowSettings(false)}
        syncing={syncing}
        online={online}
        showLogout={isSupabaseConfigured && !!email}
        onSyncNow={handleSyncNow}
        onLogin={() => navigate('/setup/login', { state: { returnTo: '/profile' } })}
        onLogout={() => setShowLogoutConfirm(true)}
        settings={settings}
        pushDescription={pushDescription}
        remindersDenied={remindersDenied}
        pushDisabled={
          !email ||
          !isWebPushSupported() ||
          !getVapidPublicKey() ||
          (remindersDenied && !settings.pushNotifications)
        }
        localRemindersDisabled={
          settings.pushNotifications || (remindersDenied && !settings.workoutReminders)
        }
        showReminderHour={showReminderHour}
        onThemeChange={(t) => {
          setSettings({ theme: t })
          applyTheme(t)
        }}
        onHighContrastChange={(checked) => {
          setSettings({ highContrast: checked })
          applyHighContrast(checked)
        }}
        onTimerSoundChange={(checked) => setSettings({ timerSound: checked })}
        onTimerVibrationChange={(checked) => setSettings({ timerVibration: checked })}
        onKeepScreenOnChange={(checked) => setSettings({ keepScreenOn: checked })}
        onWeightUnitChange={(unit) => setSettings({ weightUnit: unit })}
        onDisplayNameSave={async (name) => {
          if (!name) {
            showToast(pl.communityPublishNeedName, 'error')
            return
          }
          const prev = settings.displayName ?? ''
          setSettings({ displayName: name })
          try {
            const { refreshCommunityAuthorDisplayName } = await import('@/lib/community-api')
            await refreshCommunityAuthorDisplayName(name)
            const { pushProfileSettingsOnly } = await import('@/lib/sync')
            await pushProfileSettingsOnly()
            showToast(pl.communityDisplayNameSaved, 'success')
          } catch {
            setSettings({ displayName: prev })
            showToast(pl.communityErrorGeneric, 'error')
          }
        }}
        onPushChange={(on) => {
          void (async () => {
            if (on) {
              const ok = await subscribeWebPush(settings.reminderHour)
              if (!ok) {
                if (typeof Notification !== 'undefined') {
                  setNotifPermission(Notification.permission)
                }
                showToast(pl.pushSubscribeFailed, 'error')
                return
              }
              cancelReminder()
              setSettings({ pushNotifications: true, workoutReminders: false })
              track('reminder_toggle', { mode: 'push', on: true })
              showToast(pl.toastPushEnabled, 'success')
            } else {
              await unsubscribeWebPush()
              setSettings({ pushNotifications: false })
              track('reminder_toggle', { mode: 'push', on: false })
            }
          })()
        }}
        onLocalRemindersChange={(on) => {
          void (async () => {
            if (on) {
              if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return
              const granted = await requestWorkoutReminderPermission()
              if (!granted) return
              scheduleDailyReminder(settings.reminderHour, 0)
            } else {
              cancelReminder()
            }
            setSettings({ workoutReminders: on && Notification.permission === 'granted' })
            track('reminder_toggle', { mode: 'in_app', on })
          })()
        }}
        onReminderHourChange={(hour) => {
          setSettings({ reminderHour: hour })
          if (settings.pushNotifications) {
            void updatePushReminderHour(hour)
          } else if (settings.workoutReminders && Notification.permission === 'granted') {
            scheduleDailyReminder(hour, 0)
          }
        }}
        showDeleteAccount={isSupabaseConfigured && !!email}
        onImport={() => setShowImportSheet(true)}
        onExportJson={() => void exportJsonBackup()}
        onExportCsv={() => void exportCsvBackup()}
        onClearLocal={() => setShowClearConfirm(true)}
        onDeleteAccount={() => {
          setDeleteConfirmText('')
          setShowDeleteConfirm(true)
        }}
      />
      )}

      {customMenuPlan && (
        <Sheet open onClose={() => setCustomMenuPlanId(null)} title={customMenuPlan.name} showClose>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            className="justify-start px-4"
            onClick={() => {
              const plan = customMenuPlan
              setCustomMenuPlanId(null)
              void toggleCustomPlanPause(plan.id, plan.paused)
            }}
          >
            {customMenuPlan.paused ? pl.planResume : pl.planPause}
          </Button>
        </Sheet>
      )}

      {pendingChangeLevel && (
        <ConfirmSheet
          title={pl.menuChangeLevel}
          message={pl.changeLevelActiveWarning}
          confirmLabel={pl.confirm}
          variant="danger"
          onConfirm={() => void confirmChangeLevel()}
          onCancel={() => setPendingChangeLevel(null)}
        />
      )}
      {pendingRetest && (
        <ConfirmSheet
          title={pl.menuRetest}
          message={pl.changeLevelActiveWarning}
          confirmLabel={pl.confirm}
          variant="danger"
          onConfirm={() => void confirmRetest()}
          onCancel={() => setPendingRetest(null)}
        />
      )}
      {pendingDisable && (
        <ConfirmSheet
          title={pl.disableProgram}
          message={
            settings.enabledPrograms.length === 1
              ? pl.disableProgramConfirmLast
              : pl.disableProgramConfirm
          }
          confirmLabel={pl.confirm}
          variant="danger"
          onConfirm={() => disableProgram(pendingDisable)}
          onCancel={() => setPendingDisable(null)}
        />
      )}
      {showLogoutConfirm && (
        <ConfirmSheet
          title={pl.logout}
          message={pl.logoutConfirmMessage}
          confirmLabel={pl.logoutAndClear}
          variant="danger"
          onConfirm={() => void logoutAndClear()}
          onCancel={() => setShowLogoutConfirm(false)}
          extraActions={
            <Button variant="secondary" fullWidth onClick={() => void logoutOnly()}>
              {pl.logoutKeepData}
            </Button>
          }
        />
      )}
      {showClearConfirm && (
        <ConfirmSheet
          title={pl.clearLocalData}
          message={pl.clearLocalDataConfirm}
          confirmLabel={pl.confirm}
          variant="danger"
          onConfirm={() => void clearLocal()}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
      {showDeleteConfirm && (
        <Sheet open onClose={() => setShowDeleteConfirm(false)} title={pl.deleteAccount} showClose>
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.deleteAccountHint}</p>
          <p className="mt-2 text-sm text-[var(--sr-warning)]">{pl.deleteAccountWarning}</p>
          <TextField
            id="delete-confirm"
            className="mt-4"
            label={pl.deleteAccountTypeConfirm(pl.deleteAccountConfirmWord)}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            autoComplete="off"
          />
          <Button
            className="mt-6"
            variant="danger"
            fullWidth
            disabled={deleteConfirmText !== pl.deleteAccountConfirmWord || deletingAccount}
            onClick={() => void deleteAccount()}
          >
            {deletingAccount ? pl.deleteAccountInProgress : pl.deleteAccountConfirm}
          </Button>
          <Button variant="ghost" className="mt-2" fullWidth onClick={() => setShowDeleteConfirm(false)}>
            {pl.cancel}
          </Button>
        </Sheet>
      )}
      <ImportBackupSheet
        open={showImportSheet}
        onClose={() => setShowImportSheet(false)}
        onImported={() => void reloadMeta()}
      />
    </div>
  )
}
