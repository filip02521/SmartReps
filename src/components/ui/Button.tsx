import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary:
    'sr-btn-primary shadow-[var(--sr-shadow-glow)] hover:opacity-90',
  secondary:
    'bg-[var(--sr-bg-surface)] text-[var(--sr-text-primary)] border border-[var(--sr-border-subtle)] hover:border-[var(--sr-border-strong)]',
  ghost: 'bg-transparent text-[var(--sr-text-secondary)] hover:text-[var(--sr-text-primary)]',
  danger: 'bg-[var(--sr-error-muted)] text-[var(--sr-error)] border border-[var(--sr-error)]',
}

type Size = 'sm' | 'md' | 'lg' | 'touch'

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-[var(--sr-radius-sm)]',
  md: 'h-11 px-4 text-base rounded-[var(--sr-radius-md)]',
  lg: 'h-12 px-6 text-base rounded-[var(--sr-radius-md)]',
  touch: 'h-14 px-6 text-lg font-semibold rounded-[var(--sr-radius-md)] min-h-[var(--sr-spacing-touch)]',
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
        'inline-flex items-center justify-center font-medium transition-opacity disabled:opacity-50 disabled:pointer-events-none',
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
