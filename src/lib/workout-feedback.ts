import { vibrate } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'

const REST_SOUND_URL = '/sounds/rest-end.wav'
const SET_SOUND_URL = '/sounds/set-done.wav'

type FeedbackOptions = {
  sound?: boolean
  vibration?: boolean
}

let audioCtx: AudioContext | null = null
let restAudio: HTMLAudioElement | null = null
let setAudio: HTMLAudioElement | null = null
let unlocked = false

function getFeedbackPrefs(overrides?: FeedbackOptions): { sound: boolean; vibration: boolean } {
  const settings = useAppStore.getState().settings
  return {
    sound: overrides?.sound ?? settings.timerSound,
    vibration: overrides?.vibration ?? settings.timerVibration,
  }
}

function ensureAudioElements() {
  if (typeof Audio === 'undefined') return
  if (!restAudio) {
    restAudio = new Audio(REST_SOUND_URL)
    restAudio.preload = 'auto'
  }
  if (!setAudio) {
    setAudio = new Audio(SET_SOUND_URL)
    setAudio.preload = 'auto'
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

/** Call from a user gesture (first tap in workout) so iOS PWA allows playback. */
export async function initWorkoutAudio(): Promise<void> {
  ensureAudioElements()
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // ignore
    }
  }
  // Silent play unlock for HTMLAudioElement (iOS)
  for (const el of [restAudio, setAudio]) {
    if (!el) continue
    try {
      el.muted = true
      el.currentTime = 0
      await el.play()
      el.pause()
      el.muted = false
      el.currentTime = 0
    } catch {
      // ignore unlock failures
    }
  }
  unlocked = true
}

function playToneFallback(frequency: number, durationSec: number, gainValue: number) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(gainValue, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationSec)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationSec)
  } catch {
    // audio not available
  }
}

async function playAudioElement(el: HTMLAudioElement | null, fallback: () => void) {
  if (!el) {
    fallback()
    return
  }
  try {
    if (!unlocked) await initWorkoutAudio()
    el.currentTime = 0
    await el.play()
  } catch {
    fallback()
  }
}

export function playRestCompleteSound() {
  ensureAudioElements()
  void playAudioElement(restAudio, () => playToneFallback(880, 0.45, 0.3))
}

export function playSetCompleteSound() {
  ensureAudioElements()
  void playAudioElement(setAudio, () => playToneFallback(660, 0.18, 0.28))
}

/** @deprecated Prefer playRestCompleteSound / onRestComplete — kept for callers */
export function playChime() {
  playRestCompleteSound()
}

export function onRestComplete(overrides?: FeedbackOptions) {
  const { sound, vibration } = getFeedbackPrefs(overrides)
  const hidden =
    typeof document !== 'undefined' && document.visibilityState === 'hidden'

  if (sound) playRestCompleteSound()
  if (vibration) {
    if (hidden) vibrate([100, 80, 100])
    else vibrate(100)
  }
}

export function onSetCompleteFeedback(overrides?: FeedbackOptions) {
  const { sound, vibration } = getFeedbackPrefs(overrides)
  if (sound) playSetCompleteSound()
  if (vibration) vibrate(50)
}

export function onSetFailedFeedback(overrides?: FeedbackOptions) {
  const { vibration } = getFeedbackPrefs(overrides)
  if (vibration) vibrate([100, 50, 100])
}

/** Optional short tick when a duration goal is reached (before confirming set). */
export function playDurationGoalTick(overrides?: FeedbackOptions) {
  const { sound } = getFeedbackPrefs(overrides)
  if (!sound) return
  playToneFallback(520, 0.08, 0.2)
}
