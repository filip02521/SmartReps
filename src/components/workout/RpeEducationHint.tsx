import { useState } from 'react'
import { Info, X } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

/**
 * First-use RPE/RIR education hint.
 * Shows once when the user first encounters the RPE/RIR picker.
 * Dismissed permanently via `rpeRirEducationDismissed` setting (synced to cloud).
 *
 * Placement: above the SetLogDetails component in active workout screens.
 */
export function RpeEducationHint() {
  const dismissed = useAppStore((s) => s.settings.rpeRirEducationDismissed)
  const setSettings = useAppStore((s) => s.setSettings)
  const [expanded, setExpanded] = useState(false)

  if (dismissed) return null

  return (
    <div
      className="rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)] p-3"
      role="region"
      aria-label={pl.rpeEducationTitle}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[var(--sr-brand-primary)]" aria-hidden>
          <Info size={16} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {pl.rpeEducationTitle}
          </p>
          <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.rpeEducationSummary}
          </p>
          {expanded && (
            <div id="rpe-education-content" className="mt-2 space-y-1.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
              <p>{pl.rpeEducationRpeDesc}</p>
              <p>{pl.rpeEducationRirDesc}</p>
              <p className="text-[var(--sr-text-muted)]">{pl.rpeEducationRelationship}</p>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls="rpe-education-content"
              className={cn(
                'rounded-[var(--sr-radius-sm)] px-2 py-1 text-xs font-medium text-[var(--sr-brand-primary)] transition-colors hover:bg-[var(--sr-brand-primary)]/10',
                FOCUS_RING,
              )}
            >
              {expanded ? pl.rpeEducationHide : pl.rpeEducationLearnMore}
            </button>
            <button
              type="button"
              onClick={() => setSettings({ rpeRirEducationDismissed: true })}
              className={cn(
                'inline-flex items-center gap-1 rounded-[var(--sr-radius-sm)] px-2 py-1 text-xs font-medium text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)]',
                FOCUS_RING,
              )}
              aria-label={pl.rpeEducationDismiss}
            >
              <X size={12} aria-hidden />
              {pl.rpeEducationDismiss}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
