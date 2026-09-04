import { ChevronRight } from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { Badge } from '@/components/ui/Card'
import { pl } from '@/i18n/pl'

/**
 * AI Coach card for the Profile page — promotes coach status
 * from buried settings to a visible, branded card.
 * Tapping opens settings (where full config lives).
 */
export function AiCoachCard({
  connected,
  onOpenSettings,
}: {
  connected: boolean
  onOpenSettings: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className="flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-brand-primary)]/30 p-3.5 text-left transition-colors hover:bg-[var(--sr-bg-surface)]"
      style={{
        backgroundImage: `linear-gradient(
          135deg,
          color-mix(in srgb, var(--sr-brand-primary) 8%, var(--sr-bg-elevated)) 0%,
          var(--sr-bg-elevated) 60%
        )`,
      }}
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
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={connected ? 'success' : 'info'}>
          {connected ? pl.profileCoachCardConnected : pl.profileCoachCardOffline}
        </Badge>
        <ChevronRight size={18} className="text-[var(--sr-text-muted)]" aria-hidden />
      </div>
    </button>
  )
}
