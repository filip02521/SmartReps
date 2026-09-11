import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRestTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function generateId(): string {
  return crypto.randomUUID()
}

/** Safely parse JSON from Supabase RPC returns or storage. Returns null on malformed JSON. */
export function safeJsonParse<T = unknown>(raw: unknown): T | null {
  if (typeof raw !== 'string') return (raw as T) ?? null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

/** @deprecated Use `@/lib/workout-feedback` (`playRestCompleteSound` / `onRestComplete`). */
export function playChime() {
  // Lazy import avoided to keep utils sync; re-export behavior via dynamic require not needed —
  // callers should migrate. Thin wrapper kept for tests/back-compat.
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    // audio not available
  }
}
