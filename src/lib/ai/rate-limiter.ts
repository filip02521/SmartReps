/**
 * AI Rate Limiter — client-side quota, cooldown, and per-feature in-flight mutex.
 *
 * Design goals:
 * 1. Prevent API cost abuse — users cannot spam AI calls
 * 2. Per-feature cooldowns — each feature has a minimum interval
 * 3. Global daily quota — hard cap on total AI calls per day
 * 4. Per-feature in-flight mutex — prevents double-clicks on same feature,
 *    but allows concurrent calls across different features (e.g. auto weekly
 *    report + manual plan generation)
 * 5. Transparent — users see clear errors when rate limited
 * 6. Comfortable — cooldowns are short enough for normal use, long enough
 *    to prevent spam
 *
 * Storage: localStorage (simple, synchronous, no Dexie overhead).
 * Quota resets at local midnight.
 */

const STORAGE_KEY = 'sr-ai-usage'
const INFLIGHT_KEY = 'sr-ai-inflight'

/** Feature identifiers — each has its own cooldown and inflight slot. */
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

/**
 * Per-feature cooldown in milliseconds.
 *
 * Tuned for comfort + spam protection:
 * - weekly_report: 30 min — user might want fresh after a workout; weekKey
 *   cache already prevents auto-regeneration, cooldown only limits force
 * - post_workout: 2 min — race protection only; sessionId cache prevents
 *   duplicates for the same session
 * - workout_analysis: 30 min — user might want fresh after completing a
 *   workout; 24h TTL cache shows old result meanwhile
 * - plan_generation: 3 min — user might want to try different parameters;
 *   no cache, but 3 min is enough to prevent rapid spam
 */
const COOLDOWNS: Record<AiFeature, number> = {
  weekly_report: 30 * 60 * 1000,
  post_workout: 2 * 60 * 1000,
  workout_analysis: 30 * 60 * 1000,
  plan_generation: 3 * 60 * 1000,
}

/**
 * Global daily quota — generous but prevents runaway costs.
 *
 * Realistic daily usage:
 * - 1-2 weekly reports (auto + maybe 1 force)
 * - 1-5 post-workout insights (depends on workouts/day)
 * - 1-3 workout analyses (manual, 24h cache)
 * - 1-5 plan generations (manual, experimenting)
 * Total realistic max: ~15/day. Quota is 3x that for headroom.
 */
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
  | { allowed: false; reason: 'inflight'; feature: AiFeature }

// ─── Per-feature in-flight tracking ─────────────────────────────────────────
// Uses in-memory Set + localStorage for cross-tab safety.
// Each feature can have one concurrent call, but different features can run
// in parallel (e.g. auto weekly report + manual plan generation).

const inflightSet = new Set<AiFeature>()

function loadInflightFeatures(): Set<AiFeature> {
  try {
    const raw = localStorage.getItem(INFLIGHT_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { features: AiFeature[]; ts: number }
    // Stale inflight after 2 minutes (safety net for crashes)
    if (Date.now() - parsed.ts > 120_000) {
      localStorage.removeItem(INFLIGHT_KEY)
      return new Set()
    }
    return new Set(parsed.features)
  } catch {
    return new Set()
  }
}

function saveInflightFeatures(features: Set<AiFeature>): void {
  try {
    if (features.size === 0) {
      localStorage.removeItem(INFLIGHT_KEY)
    } else {
      localStorage.setItem(INFLIGHT_KEY, JSON.stringify({
        features: [...features],
        ts: Date.now(),
      }))
    }
  } catch {
    // non-blocking
  }
}

function isInflight(feature: AiFeature): boolean {
  if (inflightSet.has(feature)) return true
  // Check localStorage for cross-tab inflight
  const stored = loadInflightFeatures()
  if (stored.has(feature)) {
    // Sync in-memory set
    for (const f of stored) inflightSet.add(f)
    return true
  }
  return false
}

function setInflight(feature: AiFeature, value: boolean): void {
  if (value) {
    inflightSet.add(feature)
  } else {
    inflightSet.delete(feature)
  }
  // Also sync to localStorage (merge with any existing cross-tab entries)
  const stored = loadInflightFeatures()
  if (value) {
    stored.add(feature)
  } else {
    stored.delete(feature)
  }
  saveInflightFeatures(stored)
}

/**
 * Check if an AI call is allowed for the given feature.
 * Does NOT consume the quota — call `recordCall()` after a successful call.
 */
export function checkRateLimit(feature: AiFeature): RateLimitResult {
  // 1. Per-feature in-flight mutex — prevents double-click on same feature
  if (isInflight(feature)) {
    return { allowed: false, reason: 'inflight', feature }
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
 * Mark an AI call as started — sets per-feature in-flight mutex.
 * Call `releaseInflight(feature)` when the call completes (success or failure).
 */
export function acquireInflight(feature: AiFeature): void {
  setInflight(feature, true)
}

/** Release the per-feature in-flight mutex. */
export function releaseInflight(feature: AiFeature): void {
  setInflight(feature, false)
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
  // Use floor instead of ceil to avoid "1 min" for 1ms remaining.
  // Show "<1 min" for sub-minute values that haven't expired yet.
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes === 0) return '<1 min'
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
  inflightSet.clear()
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
    inflightSet.clear()
    try {
      localStorage.removeItem(INFLIGHT_KEY)
    } catch {
      // non-blocking
    }
  })
  // Cross-tab: listen for storage changes
  window.addEventListener('storage', (e) => {
    if (e.key === INFLIGHT_KEY && e.newValue === null) {
      inflightSet.clear()
    }
  })
}
