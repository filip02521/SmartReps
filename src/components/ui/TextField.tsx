import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

export function TextField({
  id,
  label,
  hint,
  className,
  inputClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode
  hint?: ReactNode
  inputClassName?: string
}) {
  return (
    <div className={className}>
      {label != null && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[var(--sr-text-secondary)]"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'mt-2 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-base text-[var(--sr-text-primary)]',
          FOCUS_RING,
          inputClassName,
        )}
        {...props}
      />
      {hint != null && (
        <p className="mt-2 text-xs text-[var(--sr-text-muted)]">{hint}</p>
      )}
    </div>
  )
}

export function CheckboxField({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'mt-1 h-5 w-5 shrink-0 rounded border-[var(--sr-border-strong)] bg-[var(--sr-bg-surface)] text-[var(--sr-brand-primary)]',
          FOCUS_RING,
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--sr-text-primary)]">{label}</span>
        {description != null && (
          <span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">{description}</span>
        )}
      </span>
    </label>
  )
}
