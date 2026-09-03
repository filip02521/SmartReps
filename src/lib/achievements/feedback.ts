import { vibrate } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { playTones, ensureSharedAudioReady, type ToneSpec } from '@/lib/audio-context'
import type { AchievementRarity } from './types'

/** Achievement unlock chimes — escalate with rarity. */
const CHIMES = {
  /** Common: soft two-note ping. */
  common: [
    { frequency: 587.33, startOffset: 0, duration: 0.12, gain: 0.18 },
    { frequency: 783.99, startOffset: 0.08, duration: 0.14, gain: 0.16 },
  ] satisfies ToneSpec[],
  /** Rare: ascending triad — clearly more rewarding. */
  rare: [
    { frequency: 523.25, startOffset: 0, duration: 0.16, gain: 0.2 },
    { frequency: 659.25, startOffset: 0.1, duration: 0.2, gain: 0.22 },
    { frequency: 880, startOffset: 0.22, duration: 0.28, gain: 0.2 },
  ] satisfies ToneSpec[],
  /** Legendary: full fanfare — five-note ascending sequence. */
  legendary: [
    { frequency: 523.25, startOffset: 0, duration: 0.18, gain: 0.22 },
    { frequency: 659.25, startOffset: 0.12, duration: 0.18, gain: 0.22 },
    { frequency: 783.99, startOffset: 0.24, duration: 0.22, gain: 0.24 },
    { frequency: 1046.5, startOffset: 0.38, duration: 0.3, gain: 0.22 },
    { frequency: 1318.5, startOffset: 0.54, duration: 0.45, gain: 0.2 },
  ] satisfies ToneSpec[],
} as const

const VIBRATION = {
  common: 60,
  rare: [60, 40, 80] as const,
  legendary: [80, 50, 80, 50, 120] as const,
} as const

function getFeedbackPrefs(): { sound: boolean; vibration: boolean } {
  const settings = useAppStore.getState().settings
  return {
    sound: settings.timerSound,
    vibration: settings.timerVibration,
  }
}

/** Play unlock feedback (sound + vibration) for a single rarity level. */
export function playAchievementUnlockFeedback(rarity: AchievementRarity) {
  const { sound, vibration } = getFeedbackPrefs()
  if (sound) {
    if (rarity === 'legendary') playTones(CHIMES.legendary)
    else if (rarity === 'rare') playTones(CHIMES.rare)
    else playTones(CHIMES.common)
  }
  if (vibration) {
    if (rarity === 'legendary') vibrate([...VIBRATION.legendary])
    else if (rarity === 'rare') vibrate([...VIBRATION.rare])
    else vibrate(VIBRATION.common)
  }
}

/**
 * Play unlock feedback for a batch of unlocks.
 * Plays only the highest rarity to avoid cacophony with multiple chimes.
 */
export function playAchievementUnlockSequence(rarities: AchievementRarity[]) {
  if (rarities.length === 0) return
  const order: Record<AchievementRarity, number> = { common: 0, rare: 1, legendary: 2 }
  const sorted = [...rarities].sort((a, b) => order[a] - order[b])
  const highest = sorted[sorted.length - 1]!
  playAchievementUnlockFeedback(highest)
}

/** Initialize audio context on user gesture (call from summary mount). */
export async function initAchievementAudio(): Promise<void> {
  await ensureSharedAudioReady()
}
