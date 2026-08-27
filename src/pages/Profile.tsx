import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/Button'
import { Card, Badge } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { pl } from '@/i18n/pl'
import { requestWorkoutReminderPermission, scheduleDailyReminder, cancelReminder } from '@/lib/notifications'
import {
  getProgramProgress,
  getActiveWorkout,
  getStatusLabel,
  getStatusTone,
  setProgramPaused,
} from '@/lib/program-service'
import { beginProgramSetup } from '@/lib/setup-flow'
import { clearAllLocalData } from '@/lib/local-data'
import { getDeadLetterCount, retryDeadLetterItems } from '@/lib/sync'
import { getCycleById } from '@/data/plans'
import { showToast } from '@/stores/toast-store'
import type { LocalProgramProgress } from '@/lib/db'
import type { Program } from '@/data/plans/types'

const programAccent: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent)',
  pullups: 'var(--sr-pullups-accent)',
}

function applyTheme(theme: 'system' | 'dark' | 'light') {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
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

  return (
    <section
      className="overflow-hidden rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]"
      aria-labelledby={`program-settings-${program}`}
    >
      <div
        className="border-l-[3px] px-4 py-3"
        style={{ borderLeftColor: programAccent[program] }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id={`program-settings-${program}`}
              className="truncate text-base font-semibold text-[var(--sr-text-primary)]"
            >
              {label}
            </h3>
            {cycle ? (
              <p className="mt-0.5 text-sm text-[var(--sr-text-secondary)]">
                {cycle.nameShort}
                {progress ? ` · ${pl.dayOfTotal(progress.currentDay, cycle.days.length)}` : ''}
                {progress && progress.cycleAttempt > 1
                  ? ` · ${pl.attemptLabel(progress.cycleAttempt)}`
                  : ''}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-[var(--sr-text-muted)]">{pl.notConfigured}</p>
            )}
          </div>
          {statusLabel && <Badge variant={badgeVariant}>{statusLabel}</Badge>}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] p-3">
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
    </section>
  )
}

export default function ProfilePage() {
  const { settings, setSettings } = useAppStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [pendingChangeLevel, setPendingChangeLevel] = useState<Program | null>(null)
  const [pendingRetest, setPendingRetest] = useState<Program | null>(null)
  const [pendingDisable, setPendingDisable] = useState<Program | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [progressByProgram, setProgressByProgram] = useState<Partial<Record<Program, LocalProgramProgress>>>({})
  const [deadLetter, setDeadLetter] = useState(0)

  const reloadMeta = async () => {
    const map: Partial<Record<Program, LocalProgramProgress>> = {}
    for (const p of settings.enabledPrograms) {
      const prog = await getProgramProgress(p)
      if (prog) map[p] = prog
    }
    setProgressByProgram(map)
    setDeadLetter(await getDeadLetterCount())
  }

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    }
    applyTheme(settings.theme)
    applyHighContrast(settings.highContrast)
    void (async () => {
      const map: Partial<Record<Program, LocalProgramProgress>> = {}
      for (const p of settings.enabledPrograms) {
        const prog = await getProgramProgress(p)
        if (prog) map[p] = prog
      }
      setProgressByProgram(map)
      setDeadLetter(await getDeadLetterCount())
    })()
  }, [settings.theme, settings.highContrast, settings.enabledPrograms])

  const logoutOnly = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut()
    setEmail(null)
    setShowLogoutConfirm(false)
  }

  const logoutAndClear = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut()
    await clearAllLocalData()
    setEmail(null)
    setShowLogoutConfirm(false)
    navigate('/setup/onboarding', { replace: true })
  }

  const clearLocal = async () => {
    await clearAllLocalData()
    setShowClearConfirm(false)
    navigate('/setup/onboarding', { replace: true })
  }

  const retest = async (program: Program) => {
    const active = await getActiveWorkout(program)
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
    const active = await getActiveWorkout(program)
    if (active) {
      setPendingChangeLevel(program)
      return
    }
    await beginProgramSetup(navigate, program)
  }

  const confirmChangeLevel = async () => {
    if (!pendingChangeLevel) return
    const program = pendingChangeLevel
    setPendingChangeLevel(null)
    await beginProgramSetup(navigate, program)
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

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top">
      <PageHeader title={pl.navProfile} />

      <Card className="mt-2 sr-card">
        <p className="text-sm font-medium text-[var(--sr-text-secondary)]">{pl.account}</p>
        <p className="mt-2 text-sm">{email ?? pl.notLoggedIn}</p>
        {isSupabaseConfigured && !email && (
          <Button className="mt-3" size="sm" fullWidth onClick={() => navigate('/setup/login')}>
            {pl.login}
          </Button>
        )}
        {isSupabaseConfigured && email && (
          <Button variant="ghost" className="mt-3" size="sm" fullWidth onClick={() => setShowLogoutConfirm(true)}>
            {pl.logout}
          </Button>
        )}
      </Card>

      <Card className="mt-4 sr-card">
        <p className="mb-3 text-sm font-medium text-[var(--sr-text-secondary)]">{pl.appearance}</p>
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
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={settings.highContrast}
            onChange={(e) => { setSettings({ highContrast: e.target.checked }); applyHighContrast(e.target.checked) }}
          />
          {pl.highContrast}
        </label>
      </Card>

      <Card className="mt-4 sr-card">
        <p className="text-sm font-medium text-[var(--sr-text-secondary)]">{pl.trainingSettings}</p>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={settings.timerSound} onChange={(e) => setSettings({ timerSound: e.target.checked })} />
          {pl.timerSound}
        </label>
        <label className="mt-1 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={settings.timerVibration} onChange={(e) => setSettings({ timerVibration: e.target.checked })} />
          {pl.timerVibration}
        </label>
        <p className="mt-2 text-xs text-[var(--sr-text-muted)]">{pl.keepScreenOn}</p>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={settings.workoutReminders}
            onChange={async (e) => {
              const on = e.target.checked
              if (on) {
                const granted = await requestWorkoutReminderPermission()
                if (!granted) return
                scheduleDailyReminder()
              } else {
                cancelReminder()
              }
              setSettings({ workoutReminders: on && Notification.permission === 'granted' })
            }}
          />
          {pl.workoutReminders}
        </label>
        <p className="mt-1 text-xs text-[var(--sr-text-muted)]">{pl.workoutRemindersHint}</p>
      </Card>

      <Card className="mt-4 sr-card">
        <p className="text-sm font-medium text-[var(--sr-text-secondary)]">{pl.programs}</p>
        <div className="mt-4 flex flex-col gap-4">
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
      </Card>

      <Card className="mt-4 sr-card">
        <p className="text-sm font-medium text-[var(--sr-text-secondary)]">{pl.about}</p>
        {deadLetter > 0 && (
          <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-warning)]/40 bg-[var(--sr-warning)]/10 p-3">
            <p className="text-sm text-[var(--sr-warning)]">{pl.syncDeadLetter(deadLetter)}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
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
        <div className="mt-4 border-t border-[var(--sr-border-subtle)] pt-3">
          <Button
            variant="ghost"
            size="md"
            fullWidth
            className="justify-start px-0 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
            onClick={() => setShowClearConfirm(true)}
          >
            {pl.clearLocalData}
          </Button>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--sr-text-secondary)]">{pl.healthDisclaimer}</p>
        <p className="mt-3 text-xs text-[var(--sr-text-muted)]">
          <a href="https://100pompek.pl" className="text-[var(--sr-brand-primary)]" target="_blank" rel="noreferrer">100pompek.pl</a>
          {' · '}
          <a href="https://podciaganie.pl" className="text-[var(--sr-brand-primary)]" target="_blank" rel="noreferrer">podciaganie.pl</a>
        </p>
      </Card>

      <p className="mt-8 text-center text-xs text-[var(--sr-text-muted)]">{pl.appName} v1.0.0</p>

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
          message={pl.logoutClearConfirm}
          confirmLabel={pl.logoutAndClear}
          cancelLabel={pl.logoutKeepData}
          variant="danger"
          onConfirm={() => void logoutAndClear()}
          onCancel={() => void logoutOnly()}
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
