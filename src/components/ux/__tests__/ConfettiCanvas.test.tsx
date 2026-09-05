import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { ConfettiCanvas } from '@/components/ux/ConfettiCanvas'

// Mock matchMedia — default to no reduced motion
const matchMediaMock = vi.fn().mockReturnValue({ matches: false })
vi.stubGlobal('matchMedia', matchMediaMock)

// Mock requestAnimationFrame
const rafMock = vi.fn((cb: FrameRequestCallback) => {
  cb(performance.now())
  return 0
})
vi.stubGlobal('requestAnimationFrame', rafMock)
vi.stubGlobal('cancelAnimationFrame', vi.fn())

// Mock performance.now
vi.stubGlobal('performance', { now: () => 1000 })

// Mock window dimensions
vi.stubGlobal('window', {
  ...window,
  innerWidth: 375,
  innerHeight: 667,
  devicePixelRatio: 2,
  matchMedia: matchMediaMock,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})

// Mock getComputedStyle
vi.stubGlobal('getComputedStyle', vi.fn().mockReturnValue({
  getPropertyValue: vi.fn((name: string) => {
    const colors: Record<string, string> = {
      '--sr-brand-primary': '#6366f1',
      '--sr-success': '#22c55e',
      '--sr-warning': '#f59e0b',
      '--sr-pushups-accent': '#f97316',
      '--sr-pullups-accent': '#a78bfa',
    }
    return colors[name] ?? ''
  }),
}))

describe('ConfettiCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchMediaMock.mockReturnValue({ matches: false })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when inactive', () => {
    const { container } = render(<ConfettiCanvas active={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when reduced motion is preferred', () => {
    matchMediaMock.mockReturnValue({ matches: true })
    const { container } = render(<ConfettiCanvas active={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders canvas when active and no reduced motion', () => {
    const { container } = render(<ConfettiCanvas active={true} />)
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    expect(canvas?.getAttribute('aria-hidden')).toBe('true')
  })

  it('has pointer-events-none class', () => {
    const { container } = render(<ConfettiCanvas active={true} />)
    const canvas = container.querySelector('canvas')
    expect(canvas?.className).toContain('pointer-events-none')
  })

  it('has fixed positioning', () => {
    const { container } = render(<ConfettiCanvas active={true} />)
    const canvas = container.querySelector('canvas')
    expect(canvas?.className).toContain('fixed')
    expect(canvas?.className).toContain('inset-0')
  })

  it('accepts custom particle count', () => {
    // Just verify it doesn't crash with custom props
    const { container } = render(
      <ConfettiCanvas active={true} particleCount={50} durationMs={1000} origin={{ x: 0.3, y: 0.5 }} />,
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })
})
