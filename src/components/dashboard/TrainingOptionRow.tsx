import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

/** Uniform compact row for secondary training options — every item in the
 *  "More workouts" group shares this anatomy: badge | title + caption | →.
 *  `icon` is a fully rendered badge node (AccentIconBadge / ProgramIconBadge). */
export function TrainingOptionRow({
  id,
  icon,
  title,
  caption,
  trailing,
  onClick,
  ariaLabel,
}: {
  id?: string
  icon: ReactNode
  title: string
  caption?: ReactNode
  trailing?: ReactNode
  onClick: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        FOCUS_RING,
        'group flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--sr-bg-elevated)]',
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
          {title}
        </p>
        {caption != null && (
          <div className="mt-0.5 truncate sr-text-caption text-[var(--sr-text-muted)]">
            {caption}
          </div>
        )}
      </div>
      {trailing ?? (
        <ChevronRight
          size={16}
          aria-hidden
          className="shrink-0 text-[var(--sr-text-muted)] transition-colors group-hover:text-[var(--sr-text-primary)]"
        />
      )}
    </button>
  )
}
