import type { ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

/** Shared home-card header row — icon tile + title on the left, status pill
 *  + ⋯ menu button on the right. Used by builtin program cards and custom
 *  plan cards so both stay visually identical. Wraps under the title on
 *  narrow screens (375px) when the badge + menu don't fit. */
export function HomeCardHeader({
  icon,
  title,
  badge,
  menuLabel,
  menuExpanded,
  onMenu,
}: {
  icon: ReactNode
  title: string
  badge: {
    label: string
    variant: 'default' | 'success' | 'warning' | 'error' | 'info'
  }
  menuLabel: string
  menuExpanded: boolean
  onMenu: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {icon}
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 break-words sr-text-h3 text-[var(--sr-text-primary)]">
            {title}
          </h3>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant={badge.variant} size="sm">
          {badge.label}
        </Badge>
        <button
          type="button"
          aria-label={menuLabel}
          aria-haspopup="dialog"
          aria-expanded={menuExpanded}
          className={cn(
            'flex min-h-11 min-w-11 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
            FOCUS_RING,
          )}
          onClick={onMenu}
        >
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  )
}
