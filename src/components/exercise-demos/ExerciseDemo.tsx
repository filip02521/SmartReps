/**
 * ExerciseDemo — full exercise demonstration card.
 * Shows animated illustration + technique cues + muscle group.
 * Uses @bryllim/workout-guide frame illustrations (CC BY-SA 4.0).
 */
import { memo, useState, useCallback, useEffect } from 'react'
import { Pause, Play, Info, ChevronDown, Dumbbell } from 'lucide-react'
import { ExerciseFigure } from './ExerciseFigure'
import { getDemoAnimationKey } from '@/lib/exercise-demo'
import type { ExerciseDefinition, MuscleGroup } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

/** Technique cues per illustration slug. */
const TECHNIQUE_CUES: Record<string, string[]> = {
  'push-up': ['exerciseTechPushup1', 'exerciseTechPushup2', 'exerciseTechPushup3'],
  'pull-up': ['exerciseTechPullup1', 'exerciseTechPullup2', 'exerciseTechPullup3'],
  'squat': ['exerciseTechSquat1', 'exerciseTechSquat2', 'exerciseTechSquat3'],
  'goblet-squat': ['exerciseTechSquat1', 'exerciseTechSquat2', 'exerciseTechSquat3'],
  'plank': ['exerciseTechPlank1', 'exerciseTechPlank2', 'exerciseTechPlank3'],
  'side-plank': ['exerciseTechPlank1', 'exerciseTechPlank2', 'exerciseTechPlank3'],
  'forward-lunge': ['exerciseTechLunge1', 'exerciseTechLunge2', 'exerciseTechLunge3'],
  'dip': ['exerciseTechDip1', 'exerciseTechDip2', 'exerciseTechDip3'],
  'burpee': ['exerciseTechBurpee1', 'exerciseTechBurpee2'],
  'bicep-curl': ['exerciseTechCurl1', 'exerciseTechCurl2'],
  'ez-bar-curl': ['exerciseTechCurl1', 'exerciseTechCurl2'],
  'overhead-press': ['exerciseTechPress1', 'exerciseTechPress2'],
  'barbell-row': ['exerciseTechRow1', 'exerciseTechRow2'],
  'lateral-raise': ['exerciseTechRaise1', 'exerciseTechRaise2'],
  'crunch': ['exerciseTechCrunch1', 'exerciseTechCrunch2'],
  'jumping-jack': ['exerciseTechJumpingJacks1', 'exerciseTechJumpingJacks2'],
  'jump-rope': ['exerciseTechJumpRope1', 'exerciseTechJumpRope2'],
  'running': ['exerciseTechRunning1', 'exerciseTechRunning2'],
  'cycling': ['exerciseTechCycling1', 'exerciseTechCycling2'],
}

function muscleGroupLabel(group: MuscleGroup): string {
  const labels: Record<MuscleGroup, string> = {
    chest: pl.muscleGroup_chest,
    back: pl.muscleGroup_back,
    shoulders: pl.muscleGroup_shoulders,
    arms: pl.muscleGroup_arms,
    core: pl.muscleGroup_core,
    legs: pl.muscleGroup_legs,
    full_body: pl.muscleGroup_full_body,
    cardio: pl.muscleGroup_cardio,
    other: pl.muscleGroup_other,
  }
  return labels[group] ?? group
}

export const ExerciseDemo = memo(function ExerciseDemo({
  exercise,
  compact = false,
  showControls = true,
  collapsible = false,
  hideNameWhenCollapsed = false,
  className,
}: {
  exercise: ExerciseDefinition | null | undefined
  compact?: boolean
  showControls?: boolean
  /** When true, renders a collapsible thumbnail that expands on tap.
   *  Designed for workout screens where vertical space is premium.
   *  Collapsed: 56px thumbnail + exercise name + chevron (~52px tall).
   *  Expanded: full compact animation (128px) + technique cues. */
  collapsible?: boolean
  /** When true + collapsible + collapsed, hides the exercise name/muscle group
   *  row. Useful when the name is already shown in the screen header. */
  hideNameWhenCollapsed?: boolean
  className?: string
}) {
  const [paused, setPaused] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const demoKey = getDemoAnimationKey(exercise)

  // Auto-pause if user prefers reduced motion
  useEffect(() => {
    if (!demoKey) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) setPaused(true)
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setPaused(true)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [demoKey])

  const togglePause = useCallback(() => setPaused((p) => !p), [])
  const toggleExpand = useCallback(() => setExpanded((e) => !e), [])

  if (!demoKey) return null

  const cues = TECHNIQUE_CUES[demoKey] ?? []
  const muscleGroup = exercise?.muscleGroup
  const exerciseName = exercise?.name?.trim() || pl.exerciseFallbackName

  // ── Collapsible mode — thumbnail strip, expands on tap ──
  // Best for workout screens: ~52px collapsed, full demo on demand.
  if (collapsible) {
    return (
      <div
        className={cn(
          'rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] overflow-hidden',
          className,
        )}
      >
        {/* Collapsed strip — thumbnail + name + chevron */}
        <button
          type="button"
          onClick={toggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? pl.exerciseDemoCollapse : pl.exerciseDemoExpand}
          className={cn(
            FOCUS_RING,
            'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--sr-bg-surface)]',
          )}
        >
          {/* Thumbnail — 56px. When collapsed: animating ExerciseFigure.
              When expanded: static Dumbbell icon to avoid double video/animation load. */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)]">
            {expanded ? (
              <Dumbbell size={22} className="text-[var(--sr-text-muted)]" aria-hidden />
            ) : (
              <ExerciseFigure demoKey={demoKey} paused={paused} />
            )}
          </div>
          {/* Exercise name + muscle group — hidden when collapsed if requested
              (e.g. workout screens where the header already shows the name).
              When name is hidden, show a subtle "show animation" hint instead. */}
          {(!hideNameWhenCollapsed || expanded) ? (
            <div className="min-w-0 flex-1">
              <p className="truncate sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
                {exerciseName}
              </p>
              {muscleGroup && (
                <p className="sr-text-caption text-[var(--sr-text-muted)]">
                  {muscleGroupLabel(muscleGroup)}
                </p>
              )}
            </div>
          ) : (
            <span className="min-w-0 flex-1 sr-text-body-sm font-medium text-[var(--sr-text-muted)]">
              {expanded ? pl.exerciseDemoCollapse : pl.exerciseDemoExpand}
            </span>
          )}
          <ChevronDown
            size={18}
            aria-hidden
            className={cn(
              'shrink-0 text-[var(--sr-text-muted)] transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </button>

        {/* Expanded content — full animation + technique cues */}
        {expanded && (
          <div className="border-t border-[var(--sr-border-subtle)] px-3 pb-3 pt-3">
            {/* Animation area */}
            <div className="relative">
              <div className="mx-auto h-32 w-32">
                <ExerciseFigure demoKey={demoKey} paused={paused} />
              </div>
              {/* Play/pause control */}
              {showControls && (
                <button
                  type="button"
                  onClick={togglePause}
                  aria-label={paused ? pl.exerciseDemoPlay : pl.exerciseDemoPause}
                  className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]"
                >
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                </button>
              )}
            </div>

            {/* Technique cues */}
            {cues.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--sr-text-secondary)]">
                  <Info size={13} aria-hidden />
                  {pl.exerciseDemoTechnique}
                </div>
                <ul className="flex flex-col gap-1">
                  {cues.map((cueKey) => (
                    <li
                      key={cueKey}
                      className="flex items-start gap-2 text-sm text-[var(--sr-text-secondary)]"
                    >
                      <span
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--sr-brand-primary)]"
                        aria-hidden
                      />
                      {pl[cueKey as keyof typeof pl] as string}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Standard mode (compact or full) ──
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4',
        className,
      )}
    >
      {/* Animation area */}
      <div className="relative">
        <div
          className={cn(
            'mx-auto',
            compact ? 'h-32 w-32' : 'h-48 w-48',
          )}
        >
          <ExerciseFigure demoKey={demoKey} paused={paused} />
        </div>

        {/* Play/pause control */}
        {showControls && (
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? pl.exerciseDemoPlay : pl.exerciseDemoPause}
            className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]"
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        )}
      </div>

      {/* Info row: muscle group + metric */}
      {!compact && (muscleGroup || exercise?.primaryMetric) && (
        <div className="flex flex-wrap items-center gap-2">
          {muscleGroup && (
            <span className="rounded-full bg-[var(--sr-brand-primary-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--sr-brand-primary)]">
              {muscleGroupLabel(muscleGroup)}
            </span>
          )}
          {exercise?.primaryMetric === 'duration_sec' && (
            <span className="rounded-full bg-[var(--sr-info-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--sr-info)]">
              {pl.exerciseMetricDuration}
            </span>
          )}
        </div>
      )}

      {/* Technique cues */}
      {!compact && cues.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--sr-text-secondary)]">
            <Info size={13} aria-hidden />
            {pl.exerciseDemoTechnique}
          </div>
          <ul className="flex flex-col gap-1">
            {cues.map((cueKey) => (
              <li
                key={cueKey}
                className="flex items-start gap-2 text-sm text-[var(--sr-text-secondary)]"
              >
                <span
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--sr-brand-primary)]"
                  aria-hidden
                />
                {pl[cueKey as keyof typeof pl] as string}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attribution */}
      {!compact && (
        <p className="text-[10px] text-[var(--sr-text-muted)]">
          {pl.exerciseDemoAttribution}
        </p>
      )}
    </div>
  )
})
