import { useCallback, useRef, type KeyboardEvent, type ClipboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { pl } from '@/i18n/pl'

/**
 * 6-digit OTP input with separate boxes, auto-advance, paste support,
 * and backspace navigation. Designed for email code verification.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled,
  autoFocus,
  error,
}: {
  length?: number
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  autoFocus?: boolean
  error?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const digits = value.padEnd(length, ' ').slice(0, length).split('')

  const focusBox = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(length - 1, idx))
      const el = refs.current[clamped]
      if (el) {
        el.focus()
        el.select()
      }
    },
    [length],
  )

  const handleChange = (idx: number, raw: string) => {
    const sanitized = raw.replace(/\D/g, '')
    if (!sanitized) {
      // User cleared this box
      const next = value.split('')
      next[idx] = ' '
      onChange(next.join('').replace(/ /g, ''))
      return
    }

    // Handle paste-like multi-digit entry in a single box
    if (sanitized.length > 1) {
      const next = Array.from({ length }, (_, i) => value[i] ?? ' ')
      let writeIdx = idx
      for (const ch of sanitized) {
        if (writeIdx >= length) break
        next[writeIdx] = ch
        writeIdx++
      }
      const result = next.join('').replace(/ /g, '')
      onChange(result.slice(0, length))
      focusBox(Math.min(writeIdx, length - 1))
      return
    }

    // Single digit
    const next = Array.from({ length }, (_, i) => value[i] ?? ' ')
    next[idx] = sanitized
    onChange(next.join('').replace(/ /g, '').slice(0, length))
    if (idx < length - 1) focusBox(idx + 1)
  }

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[idx] && digits[idx] !== ' ') {
        // Clear current box
        const next = Array.from({ length }, (_, i) => value[i] ?? ' ')
        next[idx] = ' '
        onChange(next.join('').replace(/ /g, ''))
        e.preventDefault()
      } else if (idx > 0) {
        // Move to previous and clear it
        focusBox(idx - 1)
        const next = Array.from({ length }, (_, i) => value[i] ?? ' ')
        next[idx - 1] = ' '
        onChange(next.join('').replace(/ /g, ''))
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusBox(idx - 1)
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusBox(idx + 1)
      return
    }
    if (e.key === 'Enter') {
      // Let the form handle submit
      return
    }
  }

  const handlePaste = (idx: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = Array.from({ length }, (_, i) => value[i] ?? ' ')
    let writeIdx = idx
    for (const ch of pasted) {
      if (writeIdx >= length) break
      next[writeIdx] = ch
      writeIdx++
    }
    onChange(next.join('').replace(/ /g, '').slice(0, length))
    focusBox(Math.min(writeIdx, length - 1))
  }

  return (
    <div
      className="flex justify-between gap-1.5 sm:gap-2"
      role="group"
      aria-label={pl.loginOtpAriaGroup}
    >
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && idx === 0}
          value={digit.trim()}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={(e) => handlePaste(idx, e)}
          onFocus={(e) => e.target.select()}
          aria-label={pl.loginOtpAriaDigit(idx + 1)}
          className={cn(
            'h-14 w-full min-w-0 rounded-[var(--sr-radius-md)] border bg-[var(--sr-bg-surface)] text-center text-2xl font-semibold tabular-nums text-[var(--sr-text-primary)] transition-colors',
            error
              ? 'border-[var(--sr-error)] focus:border-[var(--sr-error)]'
              : 'border-[var(--sr-border-subtle)] focus:border-[var(--sr-brand-primary)]',
            FOCUS_RING,
            disabled && 'opacity-50',
          )}
        />
      ))}
    </div>
  )
}
