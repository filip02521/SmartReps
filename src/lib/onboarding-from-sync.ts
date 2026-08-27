import { db } from '@/lib/db'
import { useAppStore } from '@/stores/app-store'

/** After cloud sync, skip onboarding when restored progress proves a returning user. */
export async function completeOnboardingIfSynced(): Promise<boolean> {
  const count = await db.programProgress.count()
  if (count === 0) return false

  const { settings, setSettings } = useAppStore.getState()
  if (settings.onboardingComplete) return true

  setSettings({ onboardingComplete: true })
  return true
}
