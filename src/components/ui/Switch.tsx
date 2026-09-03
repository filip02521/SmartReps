import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

export function Switch({
  id,
  checked,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        FOCUS_RING,
        checked
          ? 'bg-[var(--sr-brand-primary)]'
          : 'bg-[var(--sr-bg-surface)] border border-[var(--sr-border-strong)]',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
        style={{ height: '1.125rem', width: '1.125rem' }}
      />
    </button>
  )
}

export function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--sr-text-primary)]">{label}</span>
        {description != null && (
          <span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">{description}</span>
        )}
      </span>
      <Switch
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={typeof label === 'string' ? label : undefined}
      />
    </label>
  )
}
