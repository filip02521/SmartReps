import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LastWorkoutSheet } from '@/components/workout/WorkoutComponents'
import type { LocalWorkoutSession } from '@/lib/db'

const session: LocalWorkoutSession = {
  id: 's1',
  program: 'pushups',
  cycleId: 'pushups-6-10',
  dayNumber: 7,
  cycleAttempt: 1,
  status: 'completed',
  startedAt: '2026-01-05T10:00:00.000Z',
  completedAt: '2026-01-05T10:20:00.000Z',
  passed: true,
  totalReps: 42,
  setResults: [
    { setNumber: 1, target: { kind: 'exact', reps: 8 }, actual: 9, passed: true },
    { setNumber: 2, target: { kind: 'exact', reps: 8 }, actual: 8, passed: true },
    { setNumber: 3, target: { kind: 'max', minReps: 10 }, actual: 12, passed: true },
  ],
}

describe('LastWorkoutSheet', () => {
  it('shows day context and per-set target/actual rows', () => {
    render(<LastWorkoutSheet session={session} onClose={vi.fn()} />)
    expect(screen.getByText(/Dzień 7/)).not.toBeNull()
    expect(screen.getByText('9')).not.toBeNull()
    expect(screen.getByText('12')).not.toBeNull()
    expect(screen.getByText(/42/)).not.toBeNull()
  })

  it('marks a failed session', () => {
    render(<LastWorkoutSheet session={{ ...session, passed: false }} onClose={vi.fn()} />)
    expect(screen.getByText('Niezaliczony')).not.toBeNull()
  })

  it('marks a failed set row', () => {
    const withFail = {
      ...session,
      setResults: [
        { setNumber: 1, target: { kind: 'exact' as const, reps: 8 }, actual: 5, passed: false },
      ],
    }
    render(<LastWorkoutSheet session={withFail} onClose={vi.fn()} />)
    const cell = screen.getByText('5')
    expect(cell.className).toContain('--sr-error')
  })
})
