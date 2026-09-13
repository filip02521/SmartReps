import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileHero } from '@/components/profile/ProfileHero'

// UserPlanBadge reads subscription state — stub it out, the chip logic
// under test doesn't depend on plan.
vi.mock('@/components/pro/UserPlanBadge', () => ({
  UserPlanBadge: () => null,
}))

const baseProps = {
  displayName: 'Filip',
  email: 'f@example.com',
  connected: true,
  syncing: false,
  online: true,
  onSyncNow: vi.fn(),
  onLogin: vi.fn(),
  onOpenSettings: vi.fn(),
  followProfile: null,
  followCounts: { followers: 0, following: 0 },
  followLoading: false,
  onEditProfile: vi.fn(),
  onViewFollowers: vi.fn(),
  onViewFollowing: vi.fn(),
}

describe('ProfileHero — title chip', () => {
  it('renders the selected title under the name and opens the picker on tap', () => {
    const onEditTitle = vi.fn()
    render(<ProfileHero {...baseProps} profileTitleId="first_session" onEditTitle={onEditTitle} />)

    const chip = screen.getByRole('button', { name: /Tytuł profilu: Adept — zmień/ })
    expect(chip.textContent).toContain('Adept')
    fireEvent.click(chip)
    expect(onEditTitle).toHaveBeenCalledTimes(1)
  })

  it('shows the ghost CTA when no title is selected', () => {
    const onEditTitle = vi.fn()
    render(<ProfileHero {...baseProps} profileTitleId={null} onEditTitle={onEditTitle} />)

    const cta = screen.getByRole('button', { name: 'Ustaw tytuł' })
    fireEvent.click(cta)
    expect(onEditTitle).toHaveBeenCalledTimes(1)
  })

  it('falls back to the ghost CTA for a stale/invalid title id', () => {
    render(<ProfileHero {...baseProps} profileTitleId="not_a_title" onEditTitle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ustaw tytuł' })).toBeTruthy()
  })
})
