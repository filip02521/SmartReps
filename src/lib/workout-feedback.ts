import { vibrate } from '@/lib/utils'
import type { RestTimerState, RestTimerWorkerCallbacks } from '@/lib/rest-timer'
import { useAppStore } from '@/stores/app-store'
import {
  ensureSharedAudioReady,
  getSharedMasterGain,
  scheduleTone,
  type ToneSpec,
} from '@/lib/audio-context'

type FeedbackOptions = {
  sound?: boolean
  vibration?: boolean
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
  /** Short descending pair when a set fails validation. */
  failed: [
    { frequency: 330, startOffset: 0, duration: 0.14, gain: 0.17 },
    { frequency: 247, startOffset: 0.1, duration: 0.22, gain: 0.15 },
  ] satisfies ToneSpec[],
  /** Barely-there tick for countdowns and duration goals. */
  tick: [{ frequency: 620, startOffset: 0, duration: 0.045, gain: 0.14, type: 'sine' }] satisfies ToneSpec[],
  /** Final “go” cue after prep countdown hits zero. */
  go: [{ frequency: 880, startOffset: 0, duration: 0.1, gain: 0.2, type: 'sine' }] satisfies ToneSpec[],
} as const

const COUNTDOWN_FREQUENCIES = { 3: 580, 2: 660, 1: 740 } as const

const VIBRATION = {
  setComplete: 50,
  setFailed: [80, 40, 80] as const,
  restComplete: 100,
  restCompleteHidden: [100, 80, 100] as const,
  countdown: 25,
  amrapEnd: [120, 60, 120] as const,
} as const

let unlockPromise: Promise<void> | null = null

function getFeedbackPrefs(overrides?: FeedbackOptions): { sound: boolean; vibration: boolean } {
  const settings = useAppStore.getState().settings
  return {
    sound: overrides?.sound ?? settings.timerSound,
    vibration: overrides?.vibration ?? settings.timerVibration,
  }
}

async function ensureAudioReady(): Promise<AudioContext | null> {
  const ctx = await ensureSharedAudioReady()
  if (!ctx) return null

  if (!unlockPromise) {
    unlockPromise = (async () => {
      try {
        const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(getSharedMasterGain(ctx))
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

function playCountdownTone(second: 1 | 2 | 3) {
  playChimeNotes([
    {
      frequency: COUNTDOWN_FREQUENCIES[second],
      startOffset: 0,
      duration: second === 1 ? 0.06 : 0.045,
      gain: second === 1 ? 0.18 : 0.14,
      type: 'sine',
    },
  ])
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

export function playSetFailedSound() {
  playChimeNotes(CHIMES.failed)
}

export function onRestComplete(overrides?: FeedbackOptions) {
  const { sound, vibration } = getFeedbackPrefs(overrides)
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'

  if (sound) playRestCompleteSound()
  if (vibration) {
    if (hidden) vibrate([...VIBRATION.restCompleteHidden])
    else vibrate(VIBRATION.restComplete)
  }
}

export function onSetCompleteFeedback(overrides?: FeedbackOptions) {
  const { sound, vibration } = getFeedbackPrefs(overrides)
  if (sound) playSetCompleteSound()
  if (vibration) vibrate(VIBRATION.setComplete)
}

export function onSetFailedFeedback(overrides?: FeedbackOptions) {
  const { sound, vibration } = getFeedbackPrefs(overrides)
  if (sound) playSetFailedSound()
  if (vibration) vibrate([...VIBRATION.setFailed])
}

/** Last 3 seconds of rest — audible/vibration cue before the main rest chime. */
export function onRestCountdownFeedback(second: 1 | 2 | 3, overrides?: FeedbackOptions) {
  const { sound, vibration } = getFeedbackPrefs(overrides)
  if (sound) playCountdownTone(second)
  if (vibration) vibrate(VIBRATION.countdown)
}

/** Negative-prep or similar countdown (3 → 2 → 1). */
export function onPrepCountdownFeedback(second: 1 | 2 | 3, overrides?: FeedbackOptions) {
  onRestCountdownFeedback(second, overrides)
}

/** “Go” cue when prep countdown reaches zero. */
export function onPrepCountdownGoFeedback(overrides?: FeedbackOptions) {
  const { sound, vibration } = getFeedbackPrefs(overrides)
  if (sound) playChimeNotes(CHIMES.go)
  if (vibration) vibrate(VIBRATION.setComplete)
}

/** AMRAP block finished — same prominence as rest end. */
export function onAmrapBlockEndFeedback(overrides?: FeedbackOptions) {
  const { sound, vibration } = getFeedbackPrefs(overrides)
  if (sound) playRestCompleteSound()
  if (vibration) vibrate([...VIBRATION.amrapEnd])
}

/** Optional short tick when a duration goal is reached (before confirming set). */
export function playDurationGoalTick(overrides?: FeedbackOptions) {
  const { sound } = getFeedbackPrefs(overrides)
  if (!sound) return
  playChimeNotes(CHIMES.tick)
}

export function createRestTimerFeedbackSession() {
  let identity: string | null = null
  let lastCountdownSecond: number | null = null

  return {
    sync(state: RestTimerState | null) {
      if (!state?.startedAt || state.mode === 'idle') {
        identity = null
        lastCountdownSecond = null
        return
      }
      const nextId = `${state.startedAt}:${state.totalSec}`
      if (nextId !== identity) {
        identity = nextId
        lastCountdownSecond = null
      }
    },
    onTick(remainingSec: number, overrides?: FeedbackOptions) {
      if (lastCountdownSecond !== null && remainingSec > lastCountdownSecond + 1) {
        lastCountdownSecond = null
      }
      if (![3, 2, 1].includes(remainingSec)) return
      if (lastCountdownSecond === remainingSec) return
      lastCountdownSecond = remainingSec
      onRestCountdownFeedback(remainingSec as 1 | 2 | 3, overrides)
    },
    reset() {
      identity = null
      lastCountdownSecond = null
    },
  }
}

/** Adds 3-2-1 rest countdown feedback without changing timer behaviour. */
export function wrapRestTimerCallbacks(
  callbacks: RestTimerWorkerCallbacks,
  overrides?: FeedbackOptions,
): RestTimerWorkerCallbacks {
  const session = createRestTimerFeedbackSession()
  return {
    getState: callbacks.getState,
    onTick: (remainingSec) => {
      session.sync(callbacks.getState())
      session.onTick(remainingSec, overrides)
      callbacks.onTick(remainingSec)
    },
    onComplete: () => {
      session.reset()
      callbacks.onComplete()
    },
  }
}

/** @deprecated Use playRestCompleteSound — alias for older imports */
export function playChime() {
  playRestCompleteSound()
}
