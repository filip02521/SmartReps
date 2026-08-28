import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSection } from '@/components/ui/PageSection'
import { ProgramAccentCard } from '@/components/ui/ProgramAccentCard'
import { NestedStat } from '@/components/ui/NestedStat'
import { CheckboxField } from '@/components/ui/TextField'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { SkeletonCard } from '@/components/ux/Feedback'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { runAuthenticatedSync } from '@/lib/auth-sync'
import { signOutUser } from '@/lib/auth-lifecycle'
import { pl } from '@/i18n/pl'
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
  getStatusLabel,
  getStatusTone,
  setProgramPaused,
} from '@/lib/program-service'
import { beginLevelChange, beginProgramSetup } from '@/lib/setup-flow'
import { clearAllLocalData } from '@/lib/local-data'
import { getDeadLetterCount, retryDeadLetterItems } from '@/lib/sync'
import { exportSessionsCsv, downloadCsv, mergeSessionCsvExports } from '@/lib/export'
import { getCycleById } from '@/data/plans'
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

function ProgramSettingsBlock({
  program,
  progress,
  canDisable,
  onChangeLevel,
  onRetest,
  onTogglePause,
  onDisable,
}: {
  program: Program
  progress?: LocalProgramProgress
  canDisable: boolean
  onChangeLevel: () => void
  onRetest: () => void
  onTogglePause: () => void
  onDisable: () => void
}) {
  const label = program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram
  const cycle = progress ? getCycleById(progress.cycleId) : undefined
  const paused = progress?.status === 'paused'
  const statusLabel = progress ? getStatusLabel(progress) : null
  const statusTone = progress ? getStatusTone(progress) : 'info'
  const badgeVariant =
    statusTone === 'success'
      ? 'success'
      : statusTone === 'warning'
        ? 'warning'
        : statusTone === 'error'
          ? 'error'
          : 'info'

  const cycleHint =
    progress && progress.cycleAttempt > 1 ? pl.attemptLabel(progress.cycleAttempt) : undefined

  return (
    <ProgramAccentCard program={program} aria-labelledby={`program-settings-${program}`}>
      <div className="flex items-start justify-between gap-3">
        <h3
          id={`program-settings-${program}`}
          className="sr-text-h3 text-[var(--sr-text-primary)]"
          title={label}
        >
          {label}
        </h3>
        {statusLabel && <Badge variant={badgeVariant}>{statusLabel}</Badge>}
      </div>

      {cycle ? (
        <NestedStat
          className="mt-3"
          size="md"
          overline={cycle.nameShort}
          value={progress ? pl.dayOfTotal(progress.currentDay, cycle.days.length) : undefined}
          hint={cycleHint}
        />
      ) : (
        <NestedStat className="mt-3" size="md" value={pl.notConfigured} />
      )}

      <div className="mt-4 flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] pt-3">
        <Button
          variant="secondary"
          size="md"
          fullWidth
          className="justify-start px-4 font-medium"
          onClick={onChangeLevel}
        >
          {pl.menuChangeLevel}
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          className="justify-start px-4 font-medium"
          onClick={onRetest}
        >
          {pl.menuRetest}
        </Button>
        {progress && (
          <Button
            variant="ghost"
            size="md"
            fullWidth
            className="justify-start px-4 text-[var(--sr-text-secondary)]"
            onClick={onTogglePause}
          >
            {paused ? pl.resumeProgram : pl.pauseProgram}
          </Button>
        )}
        {canDisable && (
          <div className="mt-1 border-t border-[var(--sr-border-subtle)] pt-2">
            <Button
              variant="ghost"
              size="md"
              fullWidth
              className="justify-start px-4 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
              onClick={onDisable}
            >
              {pl.disableProgram}
            </Button>
          </div>
        )}
      </div>
    </ProgramAccentCard>
  )
}

export default function ProfilePage() {
  const { settings, setSettings, lastSyncedAt } = useAppStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [pendingChangeLevel, setPendingChangeLevel] = useState<Program | null>(null)
  const [pendingRetest, setPendingRetest] = useState<Program | null>(null)
  const [pendingDisable, setPendingDisable] = useState<Program | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [progressByProgram, setProgressByProgram] = useState<Partial<Record<Program, LocalProgramProgress>>>({})
  const [programsReady, setProgramsReady] = useState(false)
  const [deadLetter, setDeadLetter] = useState(0)
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
    setDeadLetter(await getDeadLetterCount())
    setProgramsReady(true)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })

    return () => subscription.unsubscribe()
    // reloadMeta reads settings.enabledPrograms; theme/contrast/programs drive this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme, settings.highContrast, settings.enabledPrograms])

  const syncStatusLabel = !online
    ? pl.syncNowOffline
    : [
        lastSyncedAt
          ? pl.syncLastAt(format(new Date(lastSyncedAt), 'd MMM yyyy, HH:mm', { locale: plLocale }))
          : pl.syncNever,
        deadLetter > 0 ? pl.syncDeadLetter(deadLetter) : null,
      ]
        .filter(Boolean)
        .join(' · ')

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

  const addProgram = async (program: Program) => {
    if (settings.enabledPrograms.includes(program)) return
    setSettings({ enabledPrograms: [...settings.enabledPrograms, program] })
    const existing = await getProgramProgress(program)
    if (!existing) {
      navigate(`/setup/test/${program}`)
    }
  }

  const disableProgram = (program: Program) => {
    const next = settings.enabledPrograms.filter((p) => p !== program)
    setSettings({ enabledPrograms: next.length ? next : settings.enabledPrograms })
    setPendingDisable(null)
  }

  const togglePause = async (program: Program) => {
    const prog = progressByProgram[program]
    if (!prog) return
    await setProgramPaused(program, prog.status !== 'paused')
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

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top">
      <PageHeader
        title={pl.navProfile}
        subtitle={email ? pl.accountLoggedIn(email) : pl.accountLocalOnly}
      />

      <PageSection title={pl.account} className="mt-2">
        <div className="flex flex-col gap-3">
          <NestedStat value={email ? syncStatusLabel : pl.notLoggedIn} />
          {isSupabaseConfigured && !email && (
            <Button
              size="touch"
              fullWidth
              onClick={() => navigate('/setup/login', { state: { returnTo: '/profile' } })}
            >
              {pl.login}
            </Button>
          )}
          {isSupabaseConfigured && email && (
            <>
              <Button
                size="touch"
                fullWidth
                disabled={!online || syncing}
                onClick={() => void handleSyncNow()}
              >
                {syncing ? pl.syncInProgress : pl.syncNow}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                className="justify-start px-4"
                onClick={() => setShowLogoutConfirm(true)}
              >
                {pl.logout}
              </Button>
            </>
          )}
        </div>
      </PageSection>

      <PageSection title={pl.appearance}>
        <SegmentedControl
          options={[
            { value: 'system' as const, label: pl.themeSystem },
            { value: 'dark' as const, label: pl.themeDark },
            { value: 'light' as const, label: pl.themeLight },
          ]}
          value={settings.theme}
          onChange={(t) => {
            setSettings({ theme: t })
            applyTheme(t)
          }}
        />
        <CheckboxField
          id="high-contrast"
          className="mt-4"
          label={pl.highContrast}
          checked={settings.highContrast}
          onChange={(checked) => {
            setSettings({ highContrast: checked })
            applyHighContrast(checked)
          }}
        />
      </PageSection>

      <PageSection title={pl.trainingSettings}>
        <div className="flex flex-col gap-1">
          <CheckboxField
            id="timer-sound"
            label={pl.timerSound}
            checked={settings.timerSound}
            onChange={(checked) => setSettings({ timerSound: checked })}
          />
          <CheckboxField
            id="timer-vibration"
            label={pl.timerVibration}
            checked={settings.timerVibration}
            onChange={(checked) => setSettings({ timerVibration: checked })}
          />
          <CheckboxField
            id="keep-screen-on"
            className="mt-2"
            label={pl.keepScreenOn}
            description={pl.keepScreenOnHint}
            checked={settings.keepScreenOn}
            onChange={(checked) => setSettings({ keepScreenOn: checked })}
          />
          <CheckboxField
            id="push-notifications"
            className="mt-2"
            label={pl.pushNotifications}
            description={pushDescription}
            checked={settings.pushNotifications}
            disabled={
              !email ||
              !isWebPushSupported() ||
              !getVapidPublicKey() ||
              (remindersDenied && !settings.pushNotifications)
            }
            onChange={(on) => {
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
          />
          <CheckboxField
            id="workout-reminders"
            className="mt-2"
            label={pl.workoutReminders}
            description={pl.workoutRemindersHint}
            checked={settings.workoutReminders && !settings.pushNotifications}
            disabled={
              settings.pushNotifications || (remindersDenied && !settings.workoutReminders)
            }
            onChange={(on) => {
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
          />
        </div>
        {remindersDenied && (
          <>
            <p className="mt-2 text-xs text-[var(--sr-warning)]">{pl.workoutRemindersDenied}</p>
            <p className="mt-1 text-xs text-[var(--sr-warning)]">{pl.pushOsSettingsHint}</p>
          </>
        )}
        <label className="mt-4 block text-sm">
          <span className="font-medium">{pl.reminderHourLabel}</span>
          <select
            className="mt-2 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-3 text-base text-[var(--sr-text-primary)]"
            value={settings.reminderHour}
            onChange={(e) => {
              const hour = Number(e.target.value)
              setSettings({ reminderHour: hour })
              if (settings.pushNotifications) {
                void updatePushReminderHour(hour)
              } else if (settings.workoutReminders && Notification.permission === 'granted') {
                scheduleDailyReminder(hour, 0)
              }
            }}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {pl.reminderHourOption(h)}
              </option>
            ))}
          </select>
        </label>
      </PageSection>

      <PageSection title={pl.programs}>
        {showProgramsLoading ? (
          <div className="flex flex-col gap-4" aria-busy aria-label={pl.profileProgramsLoading}>
            <SkeletonCard className="min-h-[9rem]" />
            {settings.enabledPrograms.length > 1 && <SkeletonCard className="min-h-[9rem]" />}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {settings.enabledPrograms.map((program) => (
              <ProgramSettingsBlock
                key={program}
                program={program}
                progress={progressByProgram[program]}
                canDisable={settings.enabledPrograms.length > 1}
                onChangeLevel={() => void changeLevel(program)}
                onRetest={() => void retest(program)}
                onTogglePause={() => void togglePause(program)}
                onDisable={() => setPendingDisable(program)}
              />
            ))}

            {missingPrograms.length > 0 && (
              <div className="rounded-[var(--sr-radius-md)] border border-dashed border-[var(--sr-border-strong)] bg-[var(--sr-bg-surface)]/60 p-3">
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
                      onClick={() => void addProgram(p)}
                    >
                      {p === 'pushups' ? pl.addProgramPushups : pl.addProgramPullups}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </PageSection>

      <PageSection title={pl.dataSection}>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            className="justify-start px-4"
            onClick={async () => {
              try {
                // All programs with local history — not only currently enabled.
                const chunks: string[] = []
                for (const program of ['pushups', 'pullups'] as const) {
                  chunks.push(await exportSessionsCsv(program))
                }
                const merged = mergeSessionCsvExports(chunks)
                downloadCsv(`smartreps-export-${new Date().toISOString().slice(0, 10)}.csv`, merged)
                showToast(pl.toastExportDone, 'success')
              } catch {
                showToast(pl.exportFailed, 'error')
              }
            }}
          >
            {pl.exportAllPrograms}
          </Button>
          {deadLetter > 0 && (
            <div className="mt-1 rounded-[var(--sr-radius-md)] border border-[var(--sr-warning)]/40 bg-[var(--sr-warning)]/10 p-3">
              <p className="text-sm text-[var(--sr-warning)]">{pl.syncDeadLetter(deadLetter)}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 justify-start px-4"
                fullWidth
                onClick={async () => {
                  const { ok } = await retryDeadLetterItems()
                  showToast(ok ? pl.toastSyncDone : pl.toastSyncFailed, ok ? 'success' : 'error')
                  await reloadMeta()
                }}
              >
                {pl.syncRetryDead}
              </Button>
            </div>
          )}
          <div className="mt-2 border-t border-[var(--sr-border-subtle)] pt-3">
            <Button
              variant="ghost"
              size="md"
              fullWidth
              className="justify-start px-4 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
              onClick={() => setShowClearConfirm(true)}
            >
              {pl.clearLocalData}
            </Button>
          </div>
        </div>
      </PageSection>

      <PageSection title={pl.about}>
        <div className="flex flex-col gap-2 text-sm">
          <Link to="/privacy" className="text-[var(--sr-brand-primary)]">
            {pl.privacyLink}
          </Link>
          <Link to="/terms" className="text-[var(--sr-brand-primary)]">
            {pl.termsLink}
          </Link>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--sr-text-secondary)]">{pl.healthDisclaimer}</p>
        <p className="mt-3 text-xs text-[var(--sr-text-muted)]">
          <a href="https://100pompek.pl" className="text-[var(--sr-brand-primary)]" target="_blank" rel="noreferrer">100pompek.pl</a>
          {' · '}
          <a href="https://podciaganie.pl" className="text-[var(--sr-brand-primary)]" target="_blank" rel="noreferrer">podciaganie.pl</a>
        </p>
        <p className="mt-4 text-xs text-[var(--sr-text-muted)]">{pl.appVersion(appVersion)}</p>
      </PageSection>

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
          message={pl.disableProgramConfirm}
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
    </div>
  )
}
