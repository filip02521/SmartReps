import { useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { RpeRirPicker } from '@/components/workout/RpeRirPicker'
import { SetNoteInput } from '@/components/workout/SetNoteInput'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

type RpeRirMode = 'rpe' | 'rir'

/**
 * Collapsible "set details" panel: RPE/RIR picker + per-set note.
 * Shared between builtin (ActiveWorkoutScreen) and custom (ActiveCustomWorkoutScreen) workouts.
 * Collapsed: compact summary chip ("RPE 7" / "RIR 3" / "+ notatka").
 * Expanded: RpeRirPicker + SetNoteInput.
 */
export function SetLogDetails({
  rpeRirValue,
  rpeRirMode,
  setNote,
  onRpeRirChange,
  onRpeRirModeChange,
  onSetNoteChange,
}: {
  rpeRirValue: number | null
  rpeRirMode: RpeRirMode
  setNote?: string
  onRpeRirChange: (v: number | null) => void
  onRpeRirModeChange: (m: RpeRirMode) => void
  onSetNoteChange: (v: string | undefined) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasRpeRir = rpeRirValue != null
  const hasNote = Boolean(setNote?.trim())
  const hasAny = hasRpeRir || hasNote

  return (
    <div className="mt-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn('flex w-full items-center gap-2 px-3 py-2 text-left', FOCUS_RING)}
        aria-expanded={expanded}
        aria-label={pl.setLogDetailsTitle}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {hasAny ? (
            <>
              {hasRpeRir && (
                <span className="inline-flex items-center rounded-full bg-[var(--sr-brand-primary-muted)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--sr-brand-primary)]">
                  {rpeRirMode === 'rpe'
                    ? pl.setLogDetailsRpeChip(rpeRirValue!)
                    : pl.setLogDetailsRirChip(rpeRirValue!)}
                </span>
              )}
              {hasNote && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--sr-text-muted)]">
                  <span aria-hidden>+</span>
                  {pl.setLogDetailsNoteChip}
                </span>
              )}
            </>
          ) : (
            <span className="flex items-center gap-1.5 sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
              <Plus size={13} className="text-[var(--sr-text-muted)]" aria-hidden />
              {pl.setLogDetailsTitle}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            'shrink-0 text-[var(--sr-text-muted)] transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-[var(--sr-border-subtle)] px-2.5 py-2">
          <RpeRirPicker
            value={rpeRirValue}
            mode={rpeRirMode}
            onChange={onRpeRirChange}
            onModeChange={onRpeRirModeChange}
            startExpanded
          />
          <SetNoteInput value={setNote} onChange={onSetNoteChange} />
        </div>
      )}
    </div>
  )
}
