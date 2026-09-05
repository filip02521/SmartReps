import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreviousResultBadge } from '@/components/workout/PreviousResultBadge'

describe('PreviousResultBadge', () => {
  it('shows "Ostatnio: X/Y" format with actual and target', () => {
    render(<PreviousResultBadge actual={15} target={20} />)
    const el = screen.getByText('Ostatnio: 15/20')
    expect(el).not.toBeNull()
  })

  it('shows different values correctly', () => {
    render(<PreviousResultBadge actual={8} target={10} />)
    const el = screen.getByText('Ostatnio: 8/10')
    expect(el).not.toBeNull()
  })

  it('renders without delta indicator (delta removed from this component)', () => {
    const { container } = render(<PreviousResultBadge actual={15} target={20} />)
    expect(container.textContent).not.toContain('▲')
    expect(container.textContent).not.toContain('▼')
  })
})
