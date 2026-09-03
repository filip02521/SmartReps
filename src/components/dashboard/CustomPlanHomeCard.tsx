import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getOrCreateCustomProgress, setCustomPlanPaused } from '@/lib/custom-plan-service'
import type { CustomPlanHomeCardModel } from '@/lib/custom-plan-home-summary'
import { cn } from '@/lib/utils'

export function CustomPlanHomeCard({
  model,
  onUpdated,
}: {
  model: CustomPlanHomeCardModel
  onUpdated?: () => void
}) {
  const navigate = useNavigate()

  return (
    <article
      className={cn(
        'rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)]',
        'bg-[var(--sr-bg-surface)] p-4',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[var(--sr-text-primary)]">{model.planName}</h3>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{model.dayLine}</p>
        </div>
        <Badge variant={model.badge.variant} className="shrink-0">
          {model.badge.label}
        </Badge>
      </div>

      <p className="mt-3 truncate text-sm text-[var(--sr-text-primary)]" title={model.previewLine}>
        {model.previewLine}
      </p>

      {model.detailLine ? (
        <p className="mt-1 text-sm text-[var(--sr-text-muted)]">{model.detailLine}</p>
      ) : null}

      <Button
        type="button"
        size="touch"
        fullWidth
        className="mt-5"
        onClick={() => {
          if (model.ctaAction === 'unpause') {
            void setCustomPlanPaused(model.planId, false).then(() => onUpdated?.())
            return
          }
          void getOrCreateCustomProgress(model.planId)
          navigate(`/workout/custom/${model.planId}`)
        }}
      >
        {model.ctaLabel}
      </Button>
    </article>
  )
}
