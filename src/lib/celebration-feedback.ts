import { useAppStore } from '@/stores/app-store'
import { ensureSharedAudioReady, getSharedMasterGain, type ToneSpec } from '@/lib/audio-context'

/**
 * Celebration sounds — played when the workout completion overlay appears.
 * Synthesized via Web Audio API (no external assets, works offline).
 * Respects user's `timerSound` setting.
 */

/** Default celebration: ascending major arpeggio with a shimmer — joyful but short. */
const CELEBRATION_DEFAULT: readonly ToneSpec[] = [
  // Ascending triad: C5 → E5 → G5
  { frequency: 523.25, startOffset: 0, duration: 0.18, gain: 0.22, type: 'triangle' },
  { frequency: 659.25, startOffset: 0.1, duration: 0.2, gain: 0.22, type: 'triangle' },
  { frequency: 783.99, startOffset: 0.2, duration: 0.28, gain: 0.24, type: 'triangle' },
  // Shimmer high note for sparkle
  { frequency: 1046.5, startOffset: 0.3, duration: 0.35, gain: 0.16, type: 'sine' },
]

/** PR celebration: fuller fanfare — five-note ascending sequence with bass anchor. */
const CELEBRATION_PR: readonly ToneSpec[] = [
  // Bass anchor for weight
  { frequency: 261.63, startOffset: 0, duration: 0.4, gain: 0.18, type: 'sine' },
  // Ascending fanfare: C5 → E5 → G5 → C6 → E6
  { frequency: 523.25, startOffset: 0.05, duration: 0.18, gain: 0.22, type: 'triangle' },
  { frequency: 659.25, startOffset: 0.15, duration: 0.18, gain: 0.22, type: 'triangle' },
  { frequency: 783.99, startOffset: 0.25, duration: 0.22, gain: 0.24, type: 'triangle' },
  { frequency: 1046.5, startOffset: 0.37, duration: 0.28, gain: 0.24, type: 'triangle' },
  // Triumphant top note
  { frequency: 1318.5, startOffset: 0.5, duration: 0.5, gain: 0.2, type: 'sine' },
]

/** Streak milestone celebration: epic seven-note fanfare with bass + shimmer cascade. */
const CELEBRATION_STREAK_MILESTONE: readonly ToneSpec[] = [
  // Deep bass anchor — weight and gravitas
  { frequency: 196.0, startOffset: 0, duration: 0.5, gain: 0.2, type: 'sine' },
  // Rising arpeggio: G3 → C4 → E4 → G4
  { frequency: 392.0, startOffset: 0.08, duration: 0.18, gain: 0.2, type: 'triangle' },
  { frequency: 523.25, startOffset: 0.18, duration: 0.18, gain: 0.22, type: 'triangle' },
  { frequency: 659.25, startOffset: 0.28, duration: 0.2, gain: 0.24, type: 'triangle' },
  { frequency: 783.99, startOffset: 0.38, duration: 0.24, gain: 0.26, type: 'triangle' },
  // Triumphant top note
  { frequency: 1046.5, startOffset: 0.52, duration: 0.4, gain: 0.24, type: 'triangle' },
  // Sparkle cascade — high shimmer for celebration
  { frequency: 1568.0, startOffset: 0.6, duration: 0.5, gain: 0.16, type: 'sine' },
  { frequency: 2093.0, startOffset: 0.72, duration: 0.4, gain: 0.12, type: 'sine' },
]

function getSoundPref(): boolean {
  return useAppStore.getState().settings.timerSound
}

/** Play the celebration sound. Call from a user-gesture-adjacent context (after workout completion). */
export function playCelebrationSound(hasPr: boolean, hasStreakMilestone = false) {
  if (!getSoundPref()) return
  void (async () => {
    const ctx = await ensureSharedAudioReady()
    if (!ctx) return
    // Priority: milestone > PR > default
    const notes = hasStreakMilestone
      ? CELEBRATION_STREAK_MILESTONE
      : hasPr
        ? CELEBRATION_PR
        : CELEBRATION_DEFAULT
    const startAt = ctx.currentTime
    const master = getSharedMasterGain(ctx)
    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const begin = startAt + note.startOffset
      const end = begin + note.duration

      osc.type = note.type ?? 'triangle'
      osc.frequency.setValueAtTime(note.frequency, begin)

      gain.gain.setValueAtTime(0.0001, begin)
      gain.gain.exponentialRampToValueAtTime(Math.max(note.gain, 0.0002), begin + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)

      osc.connect(gain)
      gain.connect(master)
      osc.start(begin)
      osc.stop(end + 0.04)
    }
  })()
}

/** Initialize audio context — call from summary mount so iOS allows playback. */
export async function initCelebrationAudio(): Promise<void> {
  await ensureSharedAudioReady()
}
