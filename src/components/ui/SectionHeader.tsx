import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type SectionHeaderProps = {
  icon?: LucideIcon
  title: string
  className?: string
  /** Optional action node on the right (e.g. button). */
  action?: ReactNode
}

/**
 * Spójny nagłówek sekcji w summary pages — ikona + overline label.
 * Używane dla: Statystyki, Notatki, Osiągnięcia, etc.
 */
export function SectionHeader({ icon: Icon, title, className, action }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-2', className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon
            size={16}
            className="text-[var(--sr-text-muted)]"
            strokeWidth={2.25}
            aria-hidden
          />
        )}
        <h2 className="sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}
