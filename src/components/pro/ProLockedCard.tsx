import { useState } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { ProTeaser } from '@/components/ux/ProTeaser'
import { ProBadge } from '@/components/ui/ProBadge'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'
import type { ProFeature } from '@/lib/feature-gating'

/**
 * Locked inline teaser for Pro-gated content sections — shows the feature
 * name + PRO chip, opens the contextual ProTeaser on tap. Used inside
 * existing sections (e.g. e1RM, body-weight correlation) so the feature
 * stays discoverable for free users instead of silently disappearing.
 */
export function ProLockedCard({
  title,
  feature,
}: {
  /** Visible feature name (e.g. pl.est1rmTitle). */
  title: string
  feature: ProFeature
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-3 rounded-[var(--sr-radius-md)] border border-dashed border-[var(--sr-border-strong)] bg-[var(--sr-bg-surface)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--sr-bg-elevated)]',
          FOCUS_RING,
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)] bg-[var(--sr-brand-primary-muted)]">
          <Lock size={15} className="text-[var(--sr-brand-primary)]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--sr-text-secondary)]">
          {title}
        </span>
        <ProBadge size="md" className="shrink-0" />
        <ChevronRight size={16} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
      </button>
      <ProTeaser open={open} onClose={() => setOpen(false)} feature={feature} />
    </>
  )
}
