/**
 * AI Rate Limiter — client-side quota, cooldown, and in-flight mutex.
 *
 * Design goals:
 * 1. Prevent API cost abuse — users cannot spam AI calls
 * 2. Per-feature cooldowns — each feature has a minimum interval
 * 3. Global daily quota — hard cap on total AI calls per day
 * 4. In-flight mutex — only one AI call at a time across the app
 * 5. Transparent — users see clear errors when rate limited
 *
 * Storage: localStorage (simple, synchronous, no Dexie overhead).
 * Quota resets at local midnight.
 */

const STORAGE_KEY = 'sr-ai-usage'
const INFLIGHT_KEY = 'sr-ai-inflight'

/** Feature identifiers — each has its own cooldown. */
export type AiFeature =
  | 'weekly_report'
  | 'post_workout'
  | 'workout_analysis'
  | 'plan_generation'

type UsageRecord = {
  /** ISO date string (YYYY-MM-DD) — used to reset quota daily. */
  date: string
  /** Total AI calls today (across all features). */
  count: number
  /** Last call timestamp per feature (ISO string). */
  lastCall: Partial<Record<AiFeature, string>>
}

/** Per-feature cooldown in milliseconds. */
const COOLDOWNS: Record<AiFeature, number> = {
  // Weekly report: cached by weekKey, force cooldown 1h
  weekly_report: 60 * 60 * 1000,
  // Post-workout: cached by sessionId, cooldown 5 min (race protection)
  post_workout: 5 * 60 * 1000,
  // Workout analysis: 24h TTL cache, cooldown 1h
  workout_analysis: 60 * 60 * 1000,
  // Plan generation: no cache, cooldown 10 min
  plan_generation: 10 * 60 * 1000,
}

/** Global daily quota — generous but prevents abuse. */
const DAILY_QUOTA = 50

function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function loadUsage(): UsageRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { date: todayKey(), count: 0, lastCall: {} }
    const parsed = JSON.parse(raw) as UsageRecord
    // Reset if day changed
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), count: 0, lastCall: {} }
    }
    return parsed
  } catch {
    return { date: todayKey(), count: 0, lastCall: {} }
  }
}

function saveUsage(u: UsageRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  } catch {
    // localStorage might be full or disabled — non-blocking
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'cooldown'; feature: AiFeature; retryAfterMs: number }
  | { allowed: false; reason: 'quota'; dailyCount: number; quota: number }
  | { allowed: false; reason: 'inflight' }

/** In-flight check using a simple flag (cleared on page unload). */
let inflightFlag = false

function isInflight(): boolean {
  // Check both in-memory flag and localStorage (for cross-tab)
  if (inflightFlag) return true
  try {
    const ts = localStorage.getItem(INFLIGHT_KEY)
    if (!ts) return false
    // Stale inflight after 2 minutes (safety net for crashes)
    const age = Date.now() - parseInt(ts, 10)
    if (age > 120_000) {
      localStorage.removeItem(INFLIGHT_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

function setInflight(value: boolean): void {
  inflightFlag = value
  try {
    if (value) {
      localStorage.setItem(INFLIGHT_KEY, String(Date.now()))
    } else {
      localStorage.removeItem(INFLIGHT_KEY)
    }
  } catch {
    // non-blocking
  }
}

/**
 * Check if an AI call is allowed for the given feature.
 * Does NOT consume the quota — call `recordCall()` after a successful call.
 */
export function checkRateLimit(feature: AiFeature): RateLimitResult {
  // 1. In-flight mutex — only one AI call at a time
  if (isInflight()) {
    return { allowed: false, reason: 'inflight' }
  }

  const usage = loadUsage()

  // 2. Global daily quota
  if (usage.count >= DAILY_QUOTA) {
    return { allowed: false, reason: 'quota', dailyCount: usage.count, quota: DAILY_QUOTA }
  }

  // 3. Per-feature cooldown
  const lastCall = usage.lastCall[feature]
  if (lastCall) {
    const elapsed = Date.now() - new Date(lastCall).getTime()
    const cooldown = COOLDOWNS[feature]
    if (elapsed < cooldown) {
      return {
        allowed: false,
        reason: 'cooldown',
        feature,
        retryAfterMs: cooldown - elapsed,
      }
    }
  }

  return { allowed: true }
}

/**
 * Mark an AI call as started — sets in-flight mutex.
 * Call `releaseInflight()` when the call completes (success or failure).
 */
export function acquireInflight(): void {
  setInflight(true)
}

/** Release the in-flight mutex. */
export function releaseInflight(): void {
  setInflight(false)
}

/**
 * Record a completed AI call — increments daily count and updates lastCall.
 * Only call this after a successful AI response (not local fallback).
 */
export function recordCall(feature: AiFeature): void {
  const usage = loadUsage()
  usage.count += 1
  usage.lastCall[feature] = new Date().toISOString()
  saveUsage(usage)
}

/** Get remaining daily quota. */
export function getRemainingQuota(): number {
  const usage = loadUsage()
  return Math.max(0, DAILY_QUOTA - usage.count)
}

/** Get cooldown remaining for a feature (ms), or 0 if no cooldown. */
export function getCooldownRemaining(feature: AiFeature): number {
  const usage = loadUsage()
  const lastCall = usage.lastCall[feature]
  if (!lastCall) return 0
  const elapsed = Date.now() - new Date(lastCall).getTime()
  const cooldown = COOLDOWNS[feature]
  return Math.max(0, cooldown - elapsed)
}

/** Format cooldown remaining as human-readable string (e.g. "45 min", "2 h 15 min"). */
export function formatCooldownRemaining(ms: number): string {
  if (ms <= 0) return ''
  const totalMinutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`
  }
  if (hours > 0) {
    return `${hours} h`
  }
  return `${minutes} min`
}

/** Clear all usage data — for testing or reset. */
export function resetRateLimit(): void {
  inflightFlag = false
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(INFLIGHT_KEY)
  } catch {
    // non-blocking
  }
}

// Safety: clear inflight on page unload (handles crashes/navigation)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    setInflight(false)
  })
  // Cross-tab: listen for storage changes
  window.addEventListener('storage', (e) => {
    if (e.key === INFLIGHT_KEY && e.newValue === null) {
      inflightFlag = false
    }
  })
}
