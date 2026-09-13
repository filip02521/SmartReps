import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/Button'
import { PageSection } from '@/components/ui/PageSection'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { Sheet } from '@/components/ui/Sheet'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useIsTrial, usePlanBadgeState, useProFeatures } from '@/lib/subscription'
import { canExport, canWebPush, type ProFeature } from '@/lib/feature-gating'
import { ProTeaser } from '@/components/ux/ProTeaser'
import { canUseManagedAi } from '@/lib/ai/managed-client'
import { ProfileAchievementsSection } from '@/components/achievements/ProfileAchievementsSection'
import { TitlePickerSheet } from '@/components/achievements/TitlePickerSheet'
import { getAllUnlocks } from '@/lib/achievements/store'
import { isTitleId } from '@/lib/achievements/titles'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'
import { ImportBackupSheet } from '@/components/profile/ImportBackupSheet'
import { SettingsSheet } from '@/components/profile/SettingsSheet'
import { ProfileStats } from '@/components/profile/ProfileStats'
import { ProfileHero } from '@/components/profile/ProfileHero'
import { ProfileServicesCard } from '@/components/profile/ProfileServicesCard'
import { AiCoachHistory } from '@/components/profile/AiCoachHistory'
import { ProfileAbout } from '@/components/profile/ProfileAbout'
import { FollowersSheet, FollowingSheet, PublicProfileSheet } from '@/components/follow/FollowManager'
import { useFollowData } from '@/hooks/useFollowData'
import { runAuthenticatedSync } from '@/lib/auth-sync'
import { signOutUser } from '@/lib/auth-lifecycle'
import { pl } from '@/i18n/pl'
import { TAB_PAGE_SHELL } from '@/lib/ui-chrome'
import { requestWorkoutReminderPermission, scheduleDailyReminder, cancelReminder } from '@/lib/notifications'
import {
  getVapidPublicKey,
  isWebPushSupported,
  subscribeWebPush,
  unsubscribeWebPush,
  updatePushReminderHour,
} from '@/lib/web-push'
import { track, AnalyticsEvents } from '@/lib/analytics'
import { applyThemeColor } from '@/lib/theme-color'
import { clearAllLocalData } from '@/lib/local-data'
import { exportSessionsCsv, exportCustomSessionsCsv, downloadCsv, mergeSessionCsvExports } from '@/lib/export'
import { exportBackupSnapshot, downloadBackupJson } from '@/lib/export-backup'
import { deleteRemoteAccount } from '@/lib/account-delete'
import { TextField } from '@/components/ui/TextField'
import { showToast } from '@/stores/toast-store'

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
  const { loggedIn } = useSupabaseAuth()
  const pro = useProFeatures()
  const isTrial = useIsTrial()
  const planState = usePlanBadgeState()
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  useSeo({ title: pl.seoProfileTitle, description: pl.seoProfileDescription, path: '/profile' })
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [showImportSheet, setShowImportSheet] = useState(false)
  const [clearingLocal, setClearingLocal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [proTeaserFeature, setProTeaserFeature] = useState<ProFeature | null>(null)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [showFollowersSheet, setShowFollowersSheet] = useState(false)
  const [showFollowingSheet, setShowFollowingSheet] = useState(false)
  const [showTitlePicker, setShowTitlePicker] = useState(false)
  const [titleUnlocks, setTitleUnlocks] = useState<LocalAchievementUnlock[]>([])
  const followData = useFollowData()
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : null,
  )
  const remindersDenied =
    notifPermission === 'denied' ||
    (typeof Notification !== 'undefined' && Notification.permission === 'denied')

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

  // Title unlocks also gate the hero's ghost "Ustaw tytuł" CTA — load eagerly
  // (cheap Dexie read) so the CTA only shows when picking is possible.
  useEffect(() => {
    void getAllUnlocks().then(setTitleUnlocks).catch(() => undefined)
  }, [])

  useEffect(() => {
    applyTheme(settings.theme)
    applyHighContrast(settings.highContrast)

    if (!isSupabaseConfigured) return

    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })

    return () => subscription.unsubscribe()
  }, [settings.theme, settings.highContrast, lastSyncedAt])

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
      // Clear suppressed achievements — different account, different badges
      const { clearSuppressedAchievements } = await import('@/lib/achievements/store')
      clearSuppressedAchievements()
      await clearAllLocalData()
      setEmail(null)
      setShowLogoutConfirm(false)
      navigate('/setup/onboarding', { replace: true })
    } catch {
      showToast(pl.logoutFailed, 'error')
    }
  }

  const clearLocal = async () => {
    setClearingLocal(true)
    try {
      // Read local achievements + fetch remote BEFORE clearing
      // so we can compute the suppressed list (false badges to never re-create)
      const { isSupabaseConfigured, supabase } = await import('@/lib/supabase/client')
      let suppressedIds: string[] = []
      let remoteAchievements: { achievement_id: string; unlocked_at: string; seen_at: string | null; tier_level?: number | null }[] | null = null
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { getAllUnlocks } = await import('@/lib/achievements/store')
          const localBefore = await getAllUnlocks()
          const { data: remote } = await supabase
            .from('user_achievements')
            .select('achievement_id, unlocked_at, seen_at, tier_level')
            .eq('user_id', session.user.id)
          remoteAchievements = remote
          const remoteIds = new Set((remote ?? []).map((r) => r.achievement_id))
          suppressedIds = localBefore
            .filter((l) => !remoteIds.has(l.id))
            .map((l) => l.id)
        }
      }

      await clearAllLocalData()
      setShowClearConfirm(false)

      // Set suppressed list BEFORE sync so scheduleAchievementCheck won't re-create
      // false achievements during the sync flow
      if (suppressedIds.length > 0) {
        const { setSuppressedAchievements } = await import('@/lib/achievements/store')
        setSuppressedAchievements(suppressedIds)
      }

      // Pre-populate local achievements from cloud + set backfill flag BEFORE sync.
      // Without this, scheduleAchievementCheck (fire-and-forget inside sync) sees
      // 0 local achievements, treats all 14 as "newly unlocked", and shows a
      // celebration sheet every time the user clears local data.
      if (remoteAchievements && remoteAchievements.length > 0) {
        const { mergeRemoteUnlocks, setBackfillFlag } = await import('@/lib/achievements/store')
        await mergeRemoteUnlocks(remoteAchievements)
        setBackfillFlag()
      }

      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Restore from cloud — pull all data + achievements
          // scheduleAchievementCheck will skip suppressed IDs and see existing
          // achievements (pre-populated above) so no celebration sheet appears
          await runAuthenticatedSync({ showSuccessToast: true, showFailureToast: true })
          // Force-reconcile achievements: cloud is source of truth
          const { forceReconcileFromCloud } = await import('@/lib/achievements/sync')
          await forceReconcileFromCloud()
          return
        }
      }
      // No session — go to onboarding
      navigate('/setup/onboarding', { replace: true })
    } catch {
      showToast(pl.toastSyncFailed, 'error')
      navigate('/setup/onboarding', { replace: true })
    } finally {
      setClearingLocal(false)
    }
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
      for (const program of ['pushups', 'pullups', 'squats'] as const) {
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

  const pushDescription = !email
    ? pl.pushNeedsLogin
    : !isWebPushSupported() || !getVapidPublicKey()
      ? pl.pushUnavailable
      : pl.pushNotificationsHint

  const showReminderHour =
    settings.pushNotifications || (settings.workoutReminders && !settings.pushNotifications)

  const displayName = settings.displayName ?? ''

  return (
    <div className={TAB_PAGE_SHELL}>
      {/* Profile hero — identity, sync status, follow stats, edit profile */}
      <ProfileHero
        displayName={displayName}
        email={email}
        connected={!!email}
        syncing={syncing}
        online={online}
        onSyncNow={handleSyncNow}
        onLogin={() => navigate('/setup/login', { state: { returnTo: '/profile' } })}
        onOpenSettings={() => setShowSettings(true)}
        followProfile={followData.profile}
        followCounts={followData.counts}
        followLoading={followData.loading}
        onEditProfile={() => setShowProfileEdit(true)}
        onViewFollowers={() => setShowFollowersSheet(true)}
        onViewFollowing={() => setShowFollowingSheet(true)}
        profileTitleId={settings.selectedTitle}
        canPickTitle={pro || titleUnlocks.some((u) => isTitleId(u.id))}
        onEditTitle={() => {
          setShowTitlePicker(true)
          // Refresh unlocks lazily on each open — local Dexie read, cheap,
          // and the set may have grown since the achievements section loaded.
          void getAllUnlocks().then(setTitleUnlocks).catch(() => setTitleUnlocks([]))
        }}
      />

      {/* Stats summary */}
      <div className="mt-6">
        <ProfileStats />
      </div>

      {/* Plan + AI Coach — one card, two rows. Plan CTA: free sees
          "Zobacz Pro", pro sees manage; coach row opens settings. */}
      <div className="mt-6">
        <ProfileServicesCard
          planAction={
            planState === 'lifetime' ? undefined : (
            <Button
              variant={pro && !isTrial ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => navigate('/pro?source=profile')}
            >
              {pro && !isTrial
                ? pl.proManageSubscription
                : planState === 'expired'
                  ? pl.proRenew
                  : pl.proUpgradeCta}
            </Button>
            )
          }
          aiConnected={pro && (!!(settings.aiApiKey ?? '').trim() || canUseManagedAi(loggedIn === true, pro))}
          aiHosted={!(settings.aiApiKey ?? '').trim() && canUseManagedAi(loggedIn === true, pro)}
          aiRequiresPro={!pro}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      {/* AI Coach history — only when AI is actually connected (Pro) */}
      {(pro && (!!(settings.aiApiKey ?? '').trim() || canUseManagedAi(loggedIn === true, pro))) && (
        <div className="mt-3">
          <AiCoachHistory />
        </div>
      )}

      {/* Achievements (gablotka) */}
      <div className="mt-6">
        <ProfileAchievementsSection />
      </div>

      {/* Title picker — single entry point: the chip under the name in the
          hero (direct manipulation — tap the displayed title to change it). */}
      <TitlePickerSheet
        open={showTitlePicker}
        onClose={() => setShowTitlePicker(false)}
        unlocks={titleUnlocks}
      />

      {/* About — redesigned with app identity, legal links, disclaimer */}
      <PageSection title={pl.profileAboutTitle} className="mt-6">
        <ProfileAbout />
      </PageSection>

      {/* Profile edit sheet — bio + public toggle */}
      {showProfileEdit && (
        <PublicProfileSheet
          open={showProfileEdit}
          onClose={() => setShowProfileEdit(false)}
          existing={followData.profile}
          displayName={displayName}
          onSaved={followData.reload}
        />
      )}

      {/* Followers sheet — who follows me */}
      {showFollowersSheet && (
        <FollowersSheet
          open={showFollowersSheet}
          onClose={() => setShowFollowersSheet(false)}
          followers={followData.followers}
          loading={followData.loading}
          error={followData.error}
          onRetry={() => void followData.reload()}
        />
      )}

      {/* Following sheet — who I follow */}
      {showFollowingSheet && (
        <FollowingSheet
          open={showFollowingSheet}
          onClose={() => setShowFollowingSheet(false)}
          followData={followData}
        />
      )}

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
        onLanguageChange={(lang) => {
          setSettings({ language: lang })
          if (typeof document !== 'undefined') {
            document.documentElement.lang = lang
          }
        }}
        onAiApiKeySave={(key) => setSettings({ aiApiKey: key })}
        onAiModelSave={(model) => setSettings({ aiModel: model })}
        onAiBaseUrlSave={(url) => setSettings({ aiBaseUrl: url })}
        onAiProactiveCoachChange={(enabled) => setSettings({ aiProactiveCoach: enabled })}
        onAiReasoningEffortChange={(effort) => setSettings({ aiReasoningEffort: effort })}
        onPushChange={(on) => {
          void (async () => {
            if (on) {
              // Web Push is Pro-only — show the paywall instead of subscribing.
              if (!canWebPush()) {
                setProTeaserFeature('webPush')
                return
              }
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
              track(AnalyticsEvents.reminderToggle, { mode: 'push', on: true })
              showToast(pl.toastPushEnabled, 'success')
            } else {
              await unsubscribeWebPush()
              setSettings({ pushNotifications: false })
              track(AnalyticsEvents.reminderToggle, { mode: 'push', on: false })
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
            track(AnalyticsEvents.reminderToggle, { mode: 'in_app', on })
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
        // JSON backup is free (data portability); CSV stays Pro.
        onExportJson={() => void exportJsonBackup()}
        onExportCsv={() =>
          canExport() ? void exportCsvBackup() : setProTeaserFeature('export')
        }
        onClearLocal={() => setShowClearConfirm(true)}
        onDeleteAccount={() => {
          setDeleteConfirmText('')
          setShowDeleteConfirm(true)
        }}
      />
      )}

      <ProTeaser
        open={proTeaserFeature != null}
        onClose={() => setProTeaserFeature(null)}
        feature={proTeaserFeature ?? undefined}
      />

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
          confirming={clearingLocal}
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
      />
    </div>
  )
}
