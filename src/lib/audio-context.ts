/** Shared AudioContext singleton — avoids creating multiple contexts on iOS PWA. */

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

export function getSharedMasterGain(ctx: AudioContext): GainNode {
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.9
    masterGain.connect(ctx.destination)
  }
  return masterGain
}

export async function ensureSharedAudioReady(): Promise<AudioContext | null> {
  const ctx = getSharedAudioContext()
  if (!ctx) return null
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return null
    }
  }
  return ctx
}

export type ToneSpec = {
  frequency: number
  startOffset: number
  duration: number
  gain: number
  type?: OscillatorType
}

export function scheduleTone(ctx: AudioContext, startAt: number, spec: ToneSpec) {
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
  gain.connect(getSharedMasterGain(ctx))
  osc.start(begin)
  osc.stop(end + 0.04)
}

export function playTones(notes: readonly ToneSpec[]) {
  void (async () => {
    const ctx = await ensureSharedAudioReady()
    if (!ctx) return
    const startAt = ctx.currentTime
    for (const note of notes) {
      scheduleTone(ctx, startAt, note)
    }
  })()
}
