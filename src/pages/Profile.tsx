import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { pl } from '@/i18n/pl'
import { requestWorkoutReminderPermission, scheduleDailyReminder, cancelReminder } from '@/lib/notifications'
import { getProgramProgress, getActiveWorkout } from '@/lib/program-service'
import { beginProgramSetup } from '@/lib/setup-flow'
import type { Program } from '@/data/plans/types'

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

export default function ProfilePage() {
  const { settings, setSettings } = useAppStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [pendingChangeLevel, setPendingChangeLevel] = useState<Program | null>(null)
  const [pendingRetest, setPendingRetest] = useState<Program | null>(null)

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    }
    applyTheme(settings.theme)
    applyHighContrast(settings.highContrast)
  }, [settings.theme, settings.highContrast])

  const logout = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut()
    setEmail(null)
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
          <Button variant="ghost" className="mt-3" size="sm" fullWidth onClick={() => void logout()}>
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
        <div className="mt-2 flex flex-col gap-2">
          {settings.enabledPrograms.includes('pushups') && (
            <>
              <Button variant="ghost" size="sm" className="min-h-11 justify-start px-0" onClick={() => void changeLevel('pushups')}>
                {pl.changeLevelPushups}
              </Button>
              <Button variant="ghost" size="sm" className="min-h-11 justify-start px-0" onClick={() => retest('pushups')}>
                {pl.retestPushups}
              </Button>
            </>
          )}
          {settings.enabledPrograms.includes('pullups') && (
            <>
              <Button variant="ghost" size="sm" className="min-h-11 justify-start px-0" onClick={() => void changeLevel('pullups')}>
                {pl.changeLevelPullups}
              </Button>
              <Button variant="ghost" size="sm" className="min-h-11 justify-start px-0" onClick={() => retest('pullups')}>
                {pl.retestPullups}
              </Button>
            </>
          )}
          {missingPrograms.length > 0 && (
            <div className="mt-2 border-t border-[var(--sr-border-subtle)] pt-3">
              <p className="mb-2 text-xs text-[var(--sr-text-muted)]">{pl.addProgram}</p>
              {missingPrograms.map((p) => (
                <Button
                  key={p}
                  variant="secondary"
                  size="sm"
                  className="mb-2 w-full"
                  onClick={() => void addProgram(p)}
                >
                  {p === 'pushups' ? pl.addProgramPushups : pl.addProgramPullups}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-4 sr-card">
        <p className="text-sm text-[var(--sr-text-secondary)]">{pl.healthDisclaimer}</p>
        <p className="mt-3 text-xs">
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
    </div>
  )
}
