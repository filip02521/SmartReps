import { vibrate } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'

type FeedbackOptions = {
  sound?: boolean
  vibration?: boolean
}

type ToneSpec = {
  frequency: number
  startOffset: number
  duration: number
  gain: number
  type?: OscillatorType
}

/** Soft triangle waves — audible but not harsh in a quiet gym/home. */
const CHIMES = {
  /** Quick double ping when a set is logged (Strong-style confirmation). */
  set: [
    { frequency: 740, startOffset: 0, duration: 0.09, gain: 0.22 },
    { frequency: 988, startOffset: 0.07, duration: 0.12, gain: 0.18 },
  ] satisfies ToneSpec[],
  /** Ascending triad when rest ends — clearly different from set ping. */
  rest: [
    { frequency: 523.25, startOffset: 0, duration: 0.22, gain: 0.2 },
    { frequency: 659.25, startOffset: 0.13, duration: 0.28, gain: 0.24 },
    { frequency: 783.99, startOffset: 0.24, duration: 0.4, gain: 0.2 },
  ] satisfies ToneSpec[],
  /** Barely-there tick when duration goal is reached. */
  tick: [{ frequency: 620, startOffset: 0, duration: 0.045, gain: 0.14, type: 'sine' }] satisfies ToneSpec[],
} as const

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let unlockPromise: Promise<void> | null = null

function getFeedbackPrefs(overrides?: FeedbackOptions): { sound: boolean; vibration: boolean } {
  const settings = useAppStore.getState().settings
  return {
    sound: overrides?.sound ?? settings.timerSound,
    vibration: overrides?.vibration ?? settings.timerVibration,
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

function getMasterGain(ctx: AudioContext): GainNode {
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.9
    masterGain.connect(ctx.destination)
  }
  return masterGain
}

function scheduleTone(ctx: AudioContext, startAt: number, spec: ToneSpec) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const begin = startAt + spec.startOffset
  const end = begin + spec.duration

  osc.type = spec.type ?? 'triangle'
  osc.frequency.setValueAtTime(spec.frequency, begin)

  gain.gain.setValueAtTime(0.0001, begin)
  gain.gain.exponentialRampToValueAtTime(Math.max(spec.gain, 0.0002), begin + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)

  osc.connect(gain)
  gain.connect(getMasterGain(ctx))
  osc.start(begin)
  osc.stop(end + 0.04)
}

async function ensureAudioReady(): Promise<AudioContext | null> {
  const ctx = getAudioContext()
  if (!ctx) return null

  if (!unlockPromise) {
    unlockPromise = (async () => {
      try {
        if (ctx.state === 'suspended') await ctx.resume()
        const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(getMasterGain(ctx))
        source.start()
        source.stop(ctx.currentTime + 0.01)
      } catch {
        // ignore — playback may still work on desktop
      }
    })()
  }

  await unlockPromise
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return null
    }
  }
  return ctx
}

function playChimeNotes(notes: readonly ToneSpec[]) {
  void (async () => {
    const ctx = await ensureAudioReady()
    if (!ctx) return
    const startAt = ctx.currentTime
    for (const note of notes) {
      scheduleTone(ctx, startAt, note)
    }
  })()
}

/** Call from a user gesture (first tap in workout) so iOS PWA allows playback. */
export async function initWorkoutAudio(): Promise<void> {
  await ensureAudioReady()
}

export function playRestCompleteSound() {
  playChimeNotes(CHIMES.rest)
}

export function playSetCompleteSound() {
  playChimeNotes(CHIMES.set)
}

export function onRestComplete(overrides?: FeedbackOptions) {
  const { sound, vibration } = getFeedbackPrefs(overrides)
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'

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
  playChimeNotes(CHIMES.tick)
}

/** @deprecated Use playRestCompleteSound — alias for older imports */
export function playChime() {
  playRestCompleteSound()
}
