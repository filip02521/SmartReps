import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, ChevronRight } from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { usePlanSummary } from '@/components/pro/PlanStatusCard'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

/**
 * Subscription + AI coach status — two compact rows in a single card
 * (replaces the separate PlanStatusCard + AiCoachCard on Profile).
 * Plan row keeps its CTA slot (upgrade/manage/renew); without an action the
 * whole row deep-links to /pro. Coach row opens the settings sheet.
 */
export function ProfileServicesCard({
  planAction,
  aiConnected,
  aiHosted,
  aiRequiresPro,
  onOpenSettings,
}: {
  /** CTA on the plan row (e.g. "Zobacz Pro"). Omit → row links to /pro. */
  planAction?: ReactNode
  aiConnected: boolean
  /** Connected through hosted SmartReps AI (Pro model server-side). */
  aiHosted?: boolean
  /** AI is Pro-only — show the PRO label instead of "not connected". */
  aiRequiresPro?: boolean
  onOpenSettings: () => void
}) {
  const navigate = useNavigate()
  const { chip, detail, tone } = usePlanSummary()

  const planInner = (
    <>
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
          tone === 'brand'
            ? 'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary-hover)]'
            : tone === 'warning'
              ? 'bg-[var(--sr-warning-muted)] text-[var(--sr-warning)]'
              : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
        )}
      >
        <Crown size={20} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
          {pl.proYourPlan}
        </p>
        <p
          className={cn(
            'truncate text-sm font-semibold',
            tone === 'brand'
              ? 'text-[var(--sr-brand-primary-hover)]'
              : tone === 'warning'
                ? 'text-[var(--sr-warning)]'
                : 'text-[var(--sr-text-primary)]',
          )}
        >
          {chip}
        </p>
        {detail && (
          <p className="truncate text-xs text-[var(--sr-text-secondary)]">{detail}</p>
        )}
      </div>
    </>
  )

  return (
    <div className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]">
      {/* Plan row — CTA slot when provided, otherwise the row links to /pro */}
      {planAction ? (
        <div className="flex items-center gap-3 px-4 py-3">
          {planInner}
          <div className="shrink-0">{planAction}</div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/pro?source=profile')}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--sr-bg-surface)]',
            FOCUS_RING,
          )}
        >
          {planInner}
          <ChevronRight size={18} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
        </button>
      )}

      {/* AI Coach row — status as colored text (not a pill) to keep the
          card quiet; tap opens settings where the full config lives. */}
      <button
        type="button"
        onClick={onOpenSettings}
        className={cn(
          'flex w-full items-center gap-3 border-t border-[var(--sr-border-subtle)] px-4 py-3 text-left transition-colors hover:bg-[var(--sr-bg-surface)]',
          FOCUS_RING,
        )}
      >
        <AiCoachMark size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--sr-text-primary)]">
            {pl.profileCoachCardTitle}
          </p>
          <p className="mt-0.5 text-xs text-[var(--sr-text-secondary)]">
            {pl.profileCoachCardHint}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 text-xs font-semibold',
            aiConnected
              ? 'text-[var(--sr-success)]'
              : aiRequiresPro
                ? 'text-[var(--sr-brand-primary)]'
                : 'text-[var(--sr-text-muted)]',
          )}
        >
          {aiConnected
            ? aiHosted
              ? pl.aiModelProBadge
              : pl.profileCoachCardConnected
            : aiRequiresPro
              ? pl.proBadge
              : pl.profileCoachCardOffline}
        </span>
        <ChevronRight size={18} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
      </button>
    </div>
  )
}
