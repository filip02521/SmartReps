import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResumeWorkoutPrompt } from '@/components/workout/ResumeWorkoutPrompt'

// Mock the dependencies that touch IndexedDB
vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: { get: vi.fn().mockResolvedValue(null) },
    customPlans: { toArray: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/lib/program-service', () => ({
  reconcileActiveWorkout: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/custom-plan-resume', () => ({
  getCustomPlanResumeInfo: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/sync', () => ({
  isStaleActiveWorkout: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/plan-resolver', () => ({
  resolveBuiltin: vi.fn().mockReturnValue(null),
  getDayPlan: vi.fn().mockReturnValue(null),
}))

describe('ResumeWorkoutPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders nothing when no active workout is found', () => {
    const { container } = render(
      <MemoryRouter>
        <ResumeWorkoutPrompt />
      </MemoryRouter>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when on a workout page', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/workout/pushups']}>
        <ResumeWorkoutPrompt />
      </MemoryRouter>,
    )
    // Should not render prompt on workout pages
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when on a custom workout page', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/workout/custom/abc123']}>
        <ResumeWorkoutPrompt />
      </MemoryRouter>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when dismissed recently', async () => {
    localStorage.setItem('resume-prompt-dismissed-at', Date.now().toString())
    const { container } = render(
      <MemoryRouter>
        <ResumeWorkoutPrompt />
      </MemoryRouter>,
    )
    expect(container.firstChild).toBeNull()
  })
})
