import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type SectionHeaderProps = {
  icon?: LucideIcon
  title: string
  className?: string
  /** Optional action node on the right (e.g. button). */
  action?: ReactNode
  /**
   * Heading level — 'h2' for top-level sections (default), 'h3' for
   * subsections nested inside a labelled section (keeps a11y outline valid).
   */
  as?: 'h2' | 'h3'
  /**
   * compact = quieter body-sm label for subsections; default = overline
   * uppercase used for page sections.
   */
  density?: 'default' | 'compact'
}

/**
 * Spójny nagłówek sekcji — ikona + label + opcjonalna akcja po prawej.
 * Używane dla sekcji stron (overline) i podsekcji (compact, h3).
 */
export function SectionHeader({
  icon: Icon,
  title,
  className,
  action,
  as: Tag = 'h2',
  density = 'default',
}: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-2', density === 'compact' && 'mb-2', className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon
            size={16}
            className="text-[var(--sr-text-muted)]"
            strokeWidth={2.25}
            aria-hidden
          />
        )}
        <Tag
          className={cn(
            'font-semibold',
            density === 'default'
              ? 'sr-text-overline uppercase tracking-wide text-[var(--sr-text-muted)]'
              : 'sr-text-body-sm text-[var(--sr-text-secondary)]',
          )}
        >
          {title}
        </Tag>
      </div>
      {action}
    </div>
  )
}
