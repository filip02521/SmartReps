import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SetRow, SetChecklist } from '@/components/workout/WorkoutComponents'
import type { SetTarget } from '@/data/plans/types'

const target: SetTarget = { kind: 'fixed', reps: 10 }

describe('SetRow delta indicator', () => {
  it('shows positive delta chip for completed set with improvement', () => {
    render(
      <SetRow
        setNumber={1}
        target={target}
        state="done"
        actual={12}
        previousActual={10}
      />,
    )
    // Delta = 12 - 10 = +2 → "+2 ▲"
    expect(screen.getByText('+2 ▲')).not.toBeNull()
  })

  it('shows negative delta chip when actual decreased', () => {
    render(
      <SetRow
        setNumber={1}
        target={target}
        state="done"
        actual={8}
        previousActual={10}
      />,
    )
    // Delta = 8 - 10 = -2 → "−2 ▼"
    expect(screen.getByText('−2 ▼')).not.toBeNull()
  })

  it('shows equal delta chip when actual matches previous', () => {
    render(
      <SetRow
        setNumber={1}
        target={target}
        state="done"
        actual={10}
        previousActual={10}
      />,
    )
    // Delta = 0 → "= ▬"
    expect(screen.getByText('= ▬')).not.toBeNull()
  })

  it('does not show delta for pending sets', () => {
    const { container } = render(
      <SetRow
        setNumber={1}
        target={target}
        state="pending"
        previousActual={10}
      />,
    )
    expect(container.textContent).not.toContain('▲')
    expect(container.textContent).not.toContain('▼')
  })

  it('does not show delta for active sets', () => {
    const { container } = render(
      <SetRow
        setNumber={1}
        target={target}
        state="active"
        actual={5}
        previousActual={10}
      />,
    )
    expect(container.textContent).not.toContain('▲')
  })

  it('does not show delta when previousActual is undefined', () => {
    const { container } = render(
      <SetRow
        setNumber={1}
        target={target}
        state="done"
        actual={12}
      />,
    )
    expect(container.textContent).not.toContain('▲')
  })

  it('does not show delta when previousActual is 0', () => {
    const { container } = render(
      <SetRow
        setNumber={1}
        target={target}
        state="done"
        actual={12}
        previousActual={0}
      />,
    )
    expect(container.textContent).not.toContain('▲')
  })

  it('does not show delta for failed sets', () => {
    const { container } = render(
      <SetRow
        setNumber={1}
        target={target}
        state="failed"
        actual={5}
        previousActual={10}
      />,
    )
    expect(container.textContent).not.toContain('▲')
  })
})

describe('SetChecklist with previousResults', () => {
  it('passes previousResults to SetRow for delta display', () => {
    const { container } = render(
      <SetChecklist
        sets={[target, target, target]}
        currentIndex={3}
        results={[
          { setNumber: 1, actual: 12, passed: true },
          { setNumber: 2, actual: 10, passed: true },
          { setNumber: 3, actual: 8, passed: true },
        ]}
        previousResults={new Map([
          [1, 10],
          [2, 10],
          [3, 10],
        ])}
      />,
    )
    // Set 1: 12 - 10 = +2 → "+2 ▲"
    expect(container.textContent).toContain('+2 ▲')
    // Set 2: 10 - 10 = 0 → "= ▬"
    expect(container.textContent).toContain('= ▬')
    // Set 3: 8 - 10 = -2 → "−2 ▼"
    expect(container.textContent).toContain('−2 ▼')
  })

  it('works without previousResults (no delta shown)', () => {
    const { container } = render(
      <SetChecklist
        sets={[target, target]}
        currentIndex={2}
        results={[
          { setNumber: 1, actual: 12, passed: true },
          { setNumber: 2, actual: 10, passed: true },
        ]}
      />,
    )
    expect(container.textContent).not.toContain('▲')
    expect(container.textContent).not.toContain('▼')
  })
})
