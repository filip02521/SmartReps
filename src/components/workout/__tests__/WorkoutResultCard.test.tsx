import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkoutResultCard } from '@/components/workout/WorkoutResultCard'
import type { PersonalRecord } from '@/lib/pr-detector'
import type { LocalAiInsight } from '@/lib/db'

const mockPr: PersonalRecord = {
  key: 'session:totalReps',
  kind: 'bestSession',
  value: 50,
  previousValue: 45,
  unit: 'reps',
}

const mockPrExercise: PersonalRecord = {
  key: 'exercise:abc:maxReps',
  kind: 'maxReps',
  exerciseName: 'Wyciskanie',
  value: 12,
  previousValue: 10,
  unit: 'reps',
}

const mockInsight: LocalAiInsight = {
  id: 'insight-1',
  type: 'post_workout',
  sessionId: 'session-1',
  title: 'Świetna sesja!',
  body: 'Progres o 3 powtórzenia — dobra progresja.',
  tone: 'success',
  source: 'local',
  createdAt: new Date().toISOString(),
}

describe('WorkoutResultCard', () => {
  it('renders status zone with success title when not failed', () => {
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Pompki · Cykl 1 · Próba 1"
        primaryLabel="Wróć na stronę główną"
        onPrimaryAction={vi.fn()}
      />,
    )
    expect(screen.getByText('Trening zaliczony')).toBeTruthy()
    expect(screen.getByText('Pompki · Cykl 1 · Próba 1')).toBeTruthy()
  })

  it('renders status zone with fail title when failed', () => {
    render(
      <WorkoutResultCard
        failed={true}
        title="Nieudany trening"
        subtitle="Pompki · Cykl 1"
        primaryLabel="Spróbuj ponownie"
        onPrimaryAction={vi.fn()}
      />,
    )
    expect(screen.getByText('Nieudany trening')).toBeTruthy()
  })

  it('renders PR zone when prRecords provided', () => {
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        prRecords={[mockPr]}
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      />,
    )
    expect(screen.getByText('Nowy rekord!')).toBeTruthy()
    expect(screen.getByText('50 powt.')).toBeTruthy()
    expect(screen.getByText('Poprzedni: 45 powt.')).toBeTruthy()
  })

  it('does not render PR zone when prRecords empty', () => {
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        prRecords={[]}
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      />,
    )
    expect(screen.queryByText('Nowy rekord!')).toBeNull()
  })

  it('renders AI zone when coachInsight provided', () => {
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        coachInsight={mockInsight}
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      />,
    )
    expect(screen.getByText('Świetna sesja!')).toBeTruthy()
    expect(screen.getByText('Progres o 3 powtórzenia — dobra progresja.')).toBeTruthy()
  })

  it('does not render AI zone when coachInsight is null', () => {
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        coachInsight={null}
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      />,
    )
    expect(screen.queryByText('Świetna sesja!')).toBeNull()
  })

  it('renders both PR and AI zones when both provided', () => {
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        prRecords={[mockPr]}
        coachInsight={mockInsight}
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      />,
    )
    expect(screen.getByText('Nowy rekord!')).toBeTruthy()
    expect(screen.getByText('Świetna sesja!')).toBeTruthy()
  })

  it('renders primary CTA button', () => {
    const onPrimaryAction = vi.fn()
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        primaryLabel="Wróć na stronę główną"
        onPrimaryAction={onPrimaryAction}
      />,
    )
    const button = screen.getByText('Wróć na stronę główną')
    fireEvent.click(button)
    expect(onPrimaryAction).toHaveBeenCalledTimes(1)
  })

  it('renders share button when onShare provided and not failed', () => {
    const onShare = vi.fn()
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
        shareLabel="Udostępnij"
        onShare={onShare}
      />,
    )
    const shareButton = screen.getByText('Udostępnij')
    fireEvent.click(shareButton)
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('does not render share button when failed', () => {
    render(
      <WorkoutResultCard
        failed={true}
        title="Spróbuj ponownie"
        subtitle="Test"
        primaryLabel="Spróbuj ponownie"
        onPrimaryAction={vi.fn()}
        shareLabel="Udostępnij"
        onShare={vi.fn()}
      />,
    )
    expect(screen.queryByText('Udostępnij')).toBeNull()
  })

  it('does not render share button when onShare not provided', () => {
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      />,
    )
    expect(screen.queryByText('Udostępnij')).toBeNull()
  })

  it('calls onDismissInsight when AI dismiss button clicked', () => {
    const onDismissInsight = vi.fn()
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        coachInsight={mockInsight}
        onDismissInsight={onDismissInsight}
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      />,
    )
    const dismissButton = screen.getByLabelText('Odrzuć')
    fireEvent.click(dismissButton)
    expect(onDismissInsight).toHaveBeenCalledTimes(1)
  })

  it('renders extra children zone when provided', () => {
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      >
        <div data-testid="extra-content">Extra zone</div>
      </WorkoutResultCard>,
    )
    expect(screen.getByTestId('extra-content')).toBeTruthy()
  })

  it('limits PR display to 3 records with "+N more" hint', () => {
    const records: PersonalRecord[] = Array.from({ length: 5 }, (_, i) => ({
      ...mockPr,
      key: `pr-${i}`,
      value: 50 + i,
    }))
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        prRecords={records}
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      />,
    )
    // Should show "+2 więcej"
    expect(screen.getByText('+2 więcej')).toBeTruthy()
  })

  it('renders exercise name in PR label for maxReps kind', () => {
    render(
      <WorkoutResultCard
        failed={false}
        title="Trening zaliczony"
        subtitle="Test"
        prRecords={[mockPrExercise]}
        primaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
      />,
    )
    expect(screen.getByText('Najwięcej powtórzeń: Wyciskanie')).toBeTruthy()
  })
})
