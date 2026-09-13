import { describe, expect, it, vi } from 'vitest'

// Mock the app store so isPro() reads a controlled subscription state.
const mockSettings = {
  subscriptionStatus: 'free' as
    | 'free'
    | 'trial'
    | 'pro'
    | 'lifetime'
    | 'expired',
  subscriptionExpiresAt: null as string | null,
  trialStartedAt: null as string | null,
}

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => ({ settings: mockSettings }),
  },
}))

import {
  FREE_CUSTOM_PLAN_LIMIT,
  FREE_PUBLICATION_LIMIT,
  canCreateCustomPlan,
  canPublishPlan,
  canCloudSync,
  canExport,
  canWebPush,
  canUseHostedAi,
  canUseAdvancedAnalytics,
  canUseManualShowcase,
  canUseFeature,
  isFeatureBlocked,
} from '@/lib/feature-gating'
import { isProStatus, planBadgeState } from '@/lib/subscription'

function setStatus(
  status: typeof mockSettings.subscriptionStatus,
  expiresAt: string | null = null,
) {
  mockSettings.subscriptionStatus = status
  mockSettings.subscriptionExpiresAt = expiresAt
}

const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
const PAST = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

describe('feature gating — free tier limits', () => {
  it('free user can create up to FREE_CUSTOM_PLAN_LIMIT plans', () => {
    setStatus('free')
    expect(canCreateCustomPlan(0)).toBe(true)
    expect(canCreateCustomPlan(FREE_CUSTOM_PLAN_LIMIT - 1)).toBe(true)
    expect(canCreateCustomPlan(FREE_CUSTOM_PLAN_LIMIT)).toBe(false)
    expect(canCreateCustomPlan(10)).toBe(false)
  })

  it('pro user has unlimited custom plans', () => {
    setStatus('pro')
    expect(canCreateCustomPlan(0)).toBe(true)
    expect(canCreateCustomPlan(100)).toBe(true)
  })

  it('trial user has unlimited custom plans while active', () => {
    setStatus('trial', FUTURE)
    expect(canCreateCustomPlan(100)).toBe(true)
    // Expired trial loses Pro access
    setStatus('trial', PAST)
    expect(canCreateCustomPlan(FREE_CUSTOM_PLAN_LIMIT)).toBe(false)
  })

  it('lifetime user has unlimited custom plans', () => {
    setStatus('lifetime')
    expect(canCreateCustomPlan(100)).toBe(true)
  })

  it('free user can publish up to FREE_PUBLICATION_LIMIT', () => {
    setStatus('free')
    expect(canPublishPlan(0)).toBe(true)
    expect(canPublishPlan(FREE_PUBLICATION_LIMIT - 1)).toBe(true)
    expect(canPublishPlan(FREE_PUBLICATION_LIMIT)).toBe(false)
  })

  it('pro user has unlimited publications', () => {
    setStatus('pro')
    expect(canPublishPlan(50)).toBe(true)
  })

  it('existing content stays usable after downgrade — limit blocks only creation', () => {
    // A user who had Pro, created 10 plans, then downgraded keeps all 10
    // (nothing is deleted) — they are only blocked from creating more.
    setStatus('expired')
    expect(canCreateCustomPlan(10)).toBe(false)
    expect(canPublishPlan(10)).toBe(false)
  })
})

describe('feature gating — Pro-only features', () => {
  it('export, web push, AI, advanced analytics require Pro', () => {
    setStatus('free')
    expect(canExport()).toBe(false)
    expect(canWebPush()).toBe(false)
    expect(canUseHostedAi()).toBe(false)
    expect(canUseAdvancedAnalytics()).toBe(false)
    // manual showcase moved to Free — personalization drives engagement
    expect(canUseManualShowcase()).toBe(true)
  })

  it('all Pro features unlock for pro/lifetime/active-trial', () => {
    for (const [status, exp] of [
      ['pro', null],
      ['lifetime', null],
      ['trial', FUTURE],
      ['pro', FUTURE],
    ] as const) {
      setStatus(status, exp)
      expect(canExport()).toBe(true)
      expect(canWebPush()).toBe(true)
      expect(canUseHostedAi()).toBe(true)
      expect(canUseAdvancedAnalytics()).toBe(true)
      expect(canUseManualShowcase()).toBe(true)
    }
  })

  it('expired pro and expired trial lose gated features', () => {
    setStatus('pro', PAST)
    expect(canExport()).toBe(false)
    expect(canUseHostedAi()).toBe(false)
    setStatus('expired')
    expect(canWebPush()).toBe(false)
    expect(canUseAdvancedAnalytics()).toBe(false)
  })
})

describe('feature gating — cloud sync is free for everyone', () => {
  it('canCloudSync is always true regardless of status', () => {
    for (const status of ['free', 'trial', 'pro', 'lifetime', 'expired'] as const) {
      setStatus(status)
      expect(canCloudSync()).toBe(true)
    }
  })

  it('cloudSync feature key is not blocked even for free users', () => {
    setStatus('free')
    expect(isFeatureBlocked('cloudSync')).toBe(false)
    expect(canUseFeature('cloudSync')).toBe(true)
  })

  it('other feature keys are blocked for free, allowed for pro', () => {
    setStatus('free')
    expect(isFeatureBlocked('export')).toBe(true)
    expect(canUseFeature('export')).toBe(false)
    setStatus('pro')
    expect(isFeatureBlocked('export')).toBe(false)
    expect(canUseFeature('export')).toBe(true)
  })
})

describe('isProStatus — status/expiry matrix', () => {
  it('lifetime is always pro', () => {
    expect(isProStatus('lifetime', null)).toBe(true)
    expect(isProStatus('lifetime', PAST)).toBe(true)
  })

  it('pro without expiry is active; with past expiry is inactive', () => {
    expect(isProStatus('pro', null)).toBe(true)
    expect(isProStatus('pro', FUTURE)).toBe(true)
    expect(isProStatus('pro', PAST)).toBe(false)
  })

  it('trial respects expiry window', () => {
    expect(isProStatus('trial', FUTURE)).toBe(true)
    expect(isProStatus('trial', PAST)).toBe(false)
  })

  it('free and expired are never pro', () => {
    expect(isProStatus('free', null)).toBe(false)
    expect(isProStatus('expired', null)).toBe(false)
    expect(isProStatus('expired', FUTURE)).toBe(false)
  })
})

describe('planBadgeState — badge mapping next to the user name', () => {
  it('maps lifetime to lifetime regardless of expiry', () => {
    expect(planBadgeState('lifetime', null)).toBe('lifetime')
    expect(planBadgeState('lifetime', PAST)).toBe('lifetime')
  })

  it('maps active pro and active trial to pro/trial', () => {
    expect(planBadgeState('pro', null)).toBe('pro')
    expect(planBadgeState('pro', FUTURE)).toBe('pro')
    expect(planBadgeState('trial', FUTURE)).toBe('trial')
  })

  it('maps lapsed trial and expired subscription to expired', () => {
    // Status stays 'trial' until the server flips it — a past expiry must
    // still surface as expired so the badge prompts renewal.
    expect(planBadgeState('trial', PAST)).toBe('expired')
    expect(planBadgeState('expired', null)).toBe('expired')
    expect(planBadgeState('pro', PAST)).toBe('expired')
  })

  it('maps free to free (ghost upsell chip)', () => {
    expect(planBadgeState('free', null)).toBe('free')
    expect(planBadgeState('free', FUTURE)).toBe('free')
  })

  it('respects an injected clock for boundary checks', () => {
    const before = new Date('2026-01-01T00:00:00Z')
    const after = new Date('2026-02-01T00:00:00Z')
    expect(planBadgeState('pro', '2026-01-15T00:00:00Z', before)).toBe('pro')
    expect(planBadgeState('pro', '2026-01-15T00:00:00Z', after)).toBe('expired')
  })
})
