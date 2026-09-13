import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProgramHomeCard } from '@/components/dashboard/ProgramHomeCard'
import type { ProgramCardModel } from '@/lib/home-summary'

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: { toArray: vi.fn().mockResolvedValue([]) },
    programProgress: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({ first: vi.fn().mockResolvedValue(undefined) })),
      })),
    },
    activeWorkout: { get: vi.fn().mockResolvedValue(undefined) },
  },
}))

vi.mock('@/lib/sync', () => ({
  enqueueSync: vi.fn().mockResolvedValue(undefined),
  enqueueActiveWorkoutSync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/stores/app-store', () => {
  const state = {
    settings: { enabledPrograms: ['pushups'], language: 'pl' as const },
  }
  const useAppStore = Object.assign(
    (sel: (s: typeof state) => unknown) => sel(state),
    { getState: () => state, setState: vi.fn(), subscribe: vi.fn(() => () => {}) },
  )
  return { useAppStore }
})

vi.mock('@/stores/toast-store', () => ({ showToast: vi.fn() }))

function model(overrides: Partial<ProgramCardModel> = {}): ProgramCardModel {
  return {
    program: 'pushups',
    label: 'Pompki',
    accent: 'var(--sr-program-pushups)',
    bucket: 'unconfigured',
    progress: null,
    stats: null,
    resume: null,
    available: true,
    daysLeft: 0,
    cycleNameShort: null,
    cycleDayCount: 0,
    currentDaySets: null,
    setsTargetTotal: null,
    loadError: null,
    lastFailed: false,
    ...overrides,
  }
}

const tipSuppression = { stale: false, test: false, level: false }

describe('ProgramHomeCard — loadError', () => {
  it('keeps the card visible with a retry action instead of disappearing', () => {
    const onReload = vi.fn()
    render(
      <MemoryRouter>
        <ProgramHomeCard
          model={model({ loadError: 'Błąd wczytywania' })}
          tipSuppression={tipSuppression}
          onReload={onReload}
        />
      </MemoryRouter>,
    )

    // The program name must stay on screen — a silent null hid the card.
    expect(screen.getByText('Pompki')).toBeTruthy()
    const retry = screen.getByRole('button', { name: 'Spróbuj jeszcze raz' })
    fireEvent.click(retry)
    expect(onReload).toHaveBeenCalledTimes(1)
  })
})
