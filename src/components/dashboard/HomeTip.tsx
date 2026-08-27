import { X } from 'lucide-react'
import { FeedbackBanner } from '@/components/ux/Feedback'
import type { HomeTipModel } from '@/lib/home-summary'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'

export function HomeTip({
  tip,
  onDismiss,
  onAction,
  onScroll,
}: {
  tip: HomeTipModel
  onDismiss: (id: string) => void
  onAction?: (program: Program) => void
  onScroll?: (program: Program) => void
}) {
  const variant = tip.kind === 'stale' ? 'warning' : 'info'

  return (
    <div className="relative mb-4">
      {tip.dismissible && (
        <button
          type="button"
          aria-label={pl.homeTipDismiss}
          className="absolute right-2 top-2 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] hover:bg-[var(--sr-bg-surface)]"
          onClick={() => onDismiss(tip.id)}
        >
          <X size={18} />
        </button>
      )}
      <FeedbackBanner
        variant={variant}
        message={tip.message}
        actionLabel={
          tip.actionLabel
            ? tip.actionLabel
            : tip.scrollProgram
              ? pl.homeTipShowCard
              : undefined
        }
        onAction={
          tip.actionLabel && tip.actionProgram && onAction
            ? () => onAction(tip.actionProgram!)
            : tip.scrollProgram && onScroll
              ? () => onScroll(tip.scrollProgram!)
              : undefined
        }
      />
    </div>
  )
}
