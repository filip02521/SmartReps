import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AiCoachHistory } from '@/components/profile/AiCoachHistory'
import type { LocalAiInsight } from '@/lib/db'

const toArrayMock = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    aiInsights: {
      orderBy: () => ({
        reverse: () => ({
          filter: () => ({ toArray: toArrayMock }),
        }),
      }),
      put: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

vi.mock('@/lib/sync', () => ({
  enqueueSync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/stores/toast-store', () => ({
  showToast: vi.fn(),
}))

function insight(overrides: Partial<LocalAiInsight>): LocalAiInsight {
  return {
    id: crypto.randomUUID(),
    type: 'post_workout',
    title: 'Podsumowanie treningu',
    body: 'Plain body text.',
    tone: 'insight',
    source: 'ai',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

const STRUCTURED_BODY = [
  'Solidny tydzień treningowy.',
  '',
  '✓ Regularność; Lepsza technika',
  '',
  '→ Za mało snu',
  '',
  '💡 Dodaj dzień mobilności',
].join('\n')

describe('AiCoachHistory', () => {
  beforeEach(() => {
    toArrayMock.mockReset()
  })

  it('shows a collapsed preview and expands to structured sections', async () => {
    toArrayMock.mockResolvedValue([
      insight({ type: 'weekly_report', title: 'Raport tygodniowy', body: STRUCTURED_BODY }),
    ])
    render(<AiCoachHistory />)

    // Collapsed: preview shows the summary line, not raw markers
    await waitFor(() => expect(screen.getByText('Raport tygodniowy')).toBeTruthy())
    expect(screen.getByText('Solidny tydzień treningowy.')).toBeTruthy()
    expect(screen.queryByText('Regularność')).toBeNull()

    // Expand → parsed sections appear with labels
    fireEvent.click(screen.getByText('Raport tygodniowy'))
    await waitFor(() => expect(screen.getByText('Regularność')).toBeTruthy())
    expect(screen.getByText('Lepsza technika')).toBeTruthy()
    expect(screen.getByText('Za mało snu')).toBeTruthy()
    expect(screen.getByText('Dodaj dzień mobilności')).toBeTruthy()
    // Collapsed preview hidden while expanded
    expect(screen.queryByText('Solidny tydzień treningowy.')).toBeTruthy() // summary still shown inside
  })

  it('renders plain bodies without section labels', async () => {
    toArrayMock.mockResolvedValue([
      insight({ body: 'Wszystkie serie zaliczone. Tak trzymaj!' }),
    ])
    render(<AiCoachHistory />)

    await waitFor(() => expect(screen.getByText('Podsumowanie treningu')).toBeTruthy())
    fireEvent.click(screen.getByText('Podsumowanie treningu'))
    await waitFor(() =>
      expect(screen.getByText('Wszystkie serie zaliczone. Tak trzymaj!')).toBeTruthy(),
    )
    expect(screen.queryByText('Co poszło dobrze')).toBeNull()
  })

  it('caps the list and reveals older items via the show-older button', async () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      insight({ id: `i${i}`, title: `Insight ${i}` }),
    )
    toArrayMock.mockResolvedValue(items)
    render(<AiCoachHistory />)

    await waitFor(() => expect(screen.getByText('Insight 0')).toBeTruthy())
    expect(screen.queryByText('Insight 5')).toBeNull()

    fireEvent.click(screen.getByText(/Pokaż starsze/))
    await waitFor(() => expect(screen.getByText('Insight 6')).toBeTruthy())
    expect(screen.getByText('Zwiń listę')).toBeTruthy()
  })

  it('marks the toggle button with aria-expanded', async () => {
    toArrayMock.mockResolvedValue([insight({ title: 'Test' })])
    render(<AiCoachHistory />)

    const btn = await waitFor(() => screen.getByRole('button', { name: /Test/ }))
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })
})
