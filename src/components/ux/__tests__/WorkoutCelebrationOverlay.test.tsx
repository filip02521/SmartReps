import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkoutCelebrationOverlay } from '@/components/ux/WorkoutCelebrationOverlay'
import { Flame, Dumbbell } from 'lucide-react'

// Mock celebration-feedback
const playCelebrationSoundMock = vi.fn()
vi.mock('@/lib/celebration-feedback', () => ({
  playCelebrationSound: (...args: unknown[]) => playCelebrationSoundMock(...args),
}))

// Mock matchMedia
const matchMediaMock = vi.fn().mockReturnValue({ matches: false })
vi.stubGlobal('matchMedia', matchMediaMock)

// Mock navigator.vibrate
const vibrateMock = vi.fn()
vi.stubGlobal('navigator', { vibrate: vibrateMock })

// Mock requestAnimationFrame
vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
  // Execute synchronously with a fake timestamp
  cb(performance.now())
  return 0
}))
vi.stubGlobal('cancelAnimationFrame', vi.fn())

// Mock performance.now to return a fixed value
vi.stubGlobal('performance', { now: () => 1000 })

describe('WorkoutCelebrationOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    matchMediaMock.mockReturnValue({ matches: false })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders nothing when inactive', () => {
    const { container } = render(
      <WorkoutCelebrationOverlay
        active={false}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders headline when active', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    // Default headline
    expect(screen.getByText('Trening ukończony!')).toBeTruthy()
  })

  it('shows PR headline when hasPr is true', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        hasPr={true}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.getByText('Nowy rekord!')).toBeTruthy()
  })

  it('shows achievement headline when hasNewAchievement is true (and no PR)', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        hasNewAchievement={true}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.getByText('Osiągnięcie odblokowane!')).toBeTruthy()
  })

  it('calls onDismiss when clicked', () => {
    const onDismiss = vi.fn()
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={onDismiss}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    const overlay = screen.getByRole('dialog')
    fireEvent.click(overlay)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when Escape is pressed', () => {
    const onDismiss = vi.fn()
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={onDismiss}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    const overlay = screen.getByRole('dialog')
    fireEvent.keyDown(overlay, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when Enter is pressed', () => {
    const onDismiss = vi.fn()
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={onDismiss}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    const overlay = screen.getByRole('dialog')
    fireEvent.keyDown(overlay, { key: 'Enter' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('auto-dismisses after duration', () => {
    const onDismiss = vi.fn()
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={onDismiss}
        durationMs={2000}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    vi.advanceTimersByTime(2000)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders stats with correct labels', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[
          { icon: Flame, value: 50, label: 'powtórzenia', animate: false },
          { icon: Dumbbell, value: 5, label: 'serie', animate: false },
        ]}
      />,
    )
    expect(screen.getByText('powtórzenia')).toBeTruthy()
    expect(screen.getByText('serie')).toBeTruthy()
  })

  it('renders PR badge when hasPr is true', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        hasPr={true}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.getByText('Nowy rekord osobisty')).toBeTruthy()
  })

  it('renders achievement badge when hasNewAchievement is true', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        hasNewAchievement={true}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.getByText('Nowe osiągnięcie')).toBeTruthy()
  })

  it('does not render badge when neither PR nor achievement', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.queryByText('Nowy rekord osobisty')).toBeNull()
    expect(screen.queryByText('Nowe osiągnięcie')).toBeNull()
  })

  it('renders tap to continue hint', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.getByText('Dotknij, aby kontynuować')).toBeTruthy()
  })

  it('handles NaN value gracefully', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: NaN, label: 'reps', animate: true }]}
      />,
    )
    // Should display 0, not "NaN"
    const statValue = screen.getByText('0')
    expect(statValue).toBeTruthy()
  })

  it('handles empty stats array', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[]}
      />,
    )
    expect(screen.getByText('Trening ukończony!')).toBeTruthy()
  })

  it('does not vibrate when reduced motion is preferred', () => {
    matchMediaMock.mockReturnValue({ matches: true })
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(vibrateMock).not.toHaveBeenCalled()
  })

  it('has correct aria attributes', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    const overlay = screen.getByRole('dialog')
    expect(overlay.getAttribute('aria-modal')).toBe('true')
    expect(overlay.getAttribute('aria-label')).toBe('Trening ukończony!')
  })

  it('renders context label when provided', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        contextLabel="Dzień 3 z 7"
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.getByText('Dzień 3 z 7')).toBeTruthy()
  })

  it('does not render context label when not provided', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.queryByText(/Dzień \d+ z \d+/)).toBeNull()
  })

  it('renders share button when onShare is provided', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        onShare={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.getByText('Udostępnij')).toBeTruthy()
  })

  it('does not render share button when onShare is not provided', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(screen.queryByText('Udostępnij')).toBeNull()
  })

  it('calls onShare when share button is clicked', () => {
    const onShare = vi.fn()
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        onShare={onShare}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    const shareButton = screen.getByText('Udostępnij')
    fireEvent.click(shareButton)
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('does not call onDismiss when share button is clicked (stopPropagation)', () => {
    const onDismiss = vi.fn()
    const onShare = vi.fn()
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={onDismiss}
        onShare={onShare}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    const shareButton = screen.getByText('Udostępnij')
    fireEvent.click(shareButton)
    expect(onShare).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('auto-dismisses after 2s (default duration)', () => {
    const onDismiss = vi.fn()
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={onDismiss}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    // Should not dismiss before 2s
    vi.advanceTimersByTime(1999)
    expect(onDismiss).not.toHaveBeenCalled()
    // Should dismiss at 2s
    vi.advanceTimersByTime(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('plays celebration sound when activated', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(playCelebrationSoundMock).toHaveBeenCalledWith(false)
  })

  it('plays PR celebration sound when hasPr is true', () => {
    render(
      <WorkoutCelebrationOverlay
        active={true}
        onDismiss={vi.fn()}
        hasPr={true}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(playCelebrationSoundMock).toHaveBeenCalledWith(true)
  })

  it('does not play sound when inactive', () => {
    render(
      <WorkoutCelebrationOverlay
        active={false}
        onDismiss={vi.fn()}
        stats={[{ icon: Flame, value: 50, label: 'reps', animate: true }]}
      />,
    )
    expect(playCelebrationSoundMock).not.toHaveBeenCalled()
  })
})
