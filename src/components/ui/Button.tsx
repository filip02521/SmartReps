import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary:
    'sr-btn-primary shadow-[var(--sr-shadow-glow)] hover:brightness-110 active:brightness-95',
  secondary:
    'bg-[var(--sr-bg-surface)] text-[var(--sr-text-primary)] border border-[var(--sr-border-subtle)] hover:border-[var(--sr-border-strong)] hover:bg-[var(--sr-bg-elevated)] active:bg-[var(--sr-bg-surface)]',
  ghost:
    'bg-transparent text-[var(--sr-text-secondary)] hover:text-[var(--sr-text-primary)] hover:bg-[var(--sr-bg-elevated)] active:bg-transparent',
  danger:
    'bg-[var(--sr-error-muted)] text-[var(--sr-error)] border border-[var(--sr-error)] hover:brightness-110 active:brightness-95',
}

type Size = 'sm' | 'md' | 'lg' | 'touch'

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-[var(--sr-radius-sm)] gap-1.5',
  md: 'h-11 px-4 text-base rounded-[var(--sr-radius-md)] gap-2',
  lg: 'h-12 px-6 text-base rounded-[var(--sr-radius-md)] gap-2',
  touch:
    'h-14 px-6 text-lg font-semibold rounded-[var(--sr-radius-md)] min-h-[var(--sr-spacing-touch)] gap-2.5',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100',
        FOCUS_RING,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
