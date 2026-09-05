import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Flame, Trophy } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { ConfettiCanvas } from '@/components/ux/ConfettiCanvas'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Z_CELEBRATION } from '@/lib/ui-chrome'

type StatItem = {
  icon: typeof Flame
  value: number
  label: string
  /** Animated count-up from 0 to value. */
  animate?: boolean
}

/**
 * Full-screen celebration overlay shown when a workout is completed.
 * Features:
 * - Confetti burst (canvas-based, respects reduced-motion)
 * - Animated check icon (scale-in + pulse)
 * - Count-up stats animation
 * - Gradient background with brand colors
 * - Auto-dismiss after 3.5s or on tap
 * - Haptic feedback (vibration) on supported devices
 */
export function WorkoutCelebrationOverlay({
  active,
  onDismiss,
  stats,
  hasPr = false,
  hasNewAchievement = false,
  durationMs = 3500,
}: {
  active: boolean
  onDismiss: () => void
  stats: StatItem[]
  hasPr?: boolean
  hasNewAchievement?: boolean
  durationMs?: number
}) {
  const [visible, setVisible] = useState(false)
  const dismissTimerRef = useRef<number | undefined>(undefined)
  const trapRef = useFocusTrap(active)
  const hasPrRef = useRef(hasPr)
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    hasPrRef.current = hasPr
    onDismissRef.current = onDismiss
  })

  const handleDismiss = useCallback(() => {
    onDismissRef.current()
  }, [])

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    // Trigger entrance animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true))

    // Haptic feedback (vibration) — respects user settings implicitly
    if (navigator.vibrate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        navigator.vibrate(hasPrRef.current ? [60, 40, 80] : 80)
      } catch {
        // ignore — vibration not supported
      }
    }

    // Auto-dismiss
    dismissTimerRef.current = window.setTimeout(handleDismiss, durationMs)

    return () => {
      cancelAnimationFrame(raf)
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current)
        dismissTimerRef.current = undefined
      }
    }
  }, [active, handleDismiss, durationMs])

  if (!active) return null

  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Headline — varies based on achievements
  const headline = hasPr
    ? pl.celebrationHeadlinePr
    : hasNewAchievement
      ? pl.celebrationHeadlineAchievement
      : pl.celebrationHeadlineDefault

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      onClick={handleDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault()
          handleDismiss()
        }
      }}
      className={cn(
        'fixed inset-0 flex flex-col items-center justify-center',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0',
        'bg-gradient-to-br from-[color-mix(in_srgb,var(--sr-brand-primary)_20%,var(--sr-bg-base))] via-[var(--sr-bg-base)] to-[color-mix(in_srgb,var(--sr-success)_15%,var(--sr-bg-base))]',
      )}
      style={{ zIndex: Z_CELEBRATION }}
    >
      {/* Confetti layer */}
      <ConfettiCanvas active={active && !prefersReduced} durationMs={2500} particleCount={100} />

      {/* Content */}
      <div
        className={cn(
          'relative z-10 flex flex-col items-center px-6 text-center',
          'transition-all duration-500',
          visible ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95',
        )}
      >
        {/* Animated check icon */}
        <div
          className={cn(
            'mb-6 flex h-24 w-24 items-center justify-center rounded-full',
            'bg-[color-mix(in_srgb,var(--sr-success)_20%,transparent)]',
          )}
          style={
            !prefersReduced
              ? {
                  animation: 'srCelebrationPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }
              : undefined
          }
        >
          <CheckCircle2
            size={56}
            className="text-[var(--sr-success)]"
            strokeWidth={2.5}
            style={
              !prefersReduced
                ? {
                    animation: 'srCelebrationCheck 0.4s ease-out 0.2s both',
                  }
                : undefined
            }
          />
        </div>

        {/* Headline */}
        <h1
          className="sr-text-h1 text-[var(--sr-text-primary)]"
          style={
            !prefersReduced
              ? {
                  animation: 'srCelebrationFadeUp 0.5s ease-out 0.3s both',
                }
              : undefined
          }
        >
          {headline}
        </h1>

        {/* Subtitle */}
        <p
          className="mt-2 sr-text-body text-[var(--sr-text-secondary)]"
          style={
            !prefersReduced
              ? {
                  animation: 'srCelebrationFadeUp 0.5s ease-out 0.45s both',
                }
              : undefined
          }
        >
          {pl.celebrationSubtitle}
        </p>

        {/* Stats with count-up */}
        <div
          className="mt-8 flex items-center gap-6"
          style={
            !prefersReduced
              ? {
                  animation: 'srCelebrationFadeUp 0.5s ease-out 0.6s both',
                }
              : undefined
          }
        >
          {stats.map((stat, i) => (
            <StatCounter
              key={i}
              icon={stat.icon}
              value={stat.value}
              label={stat.label}
              animate={(stat.animate ?? false) && !prefersReduced}
              delay={0.7 + i * 0.1}
            />
          ))}
        </div>

        {/* PR / Achievement badge */}
        {(hasPr || hasNewAchievement) && (
          <div
            className={cn(
              'mt-6 flex items-center gap-2 rounded-full px-4 py-2',
              hasPr
                ? 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_15%,transparent)]'
                : 'bg-[color-mix(in_srgb,var(--sr-warning)_15%,transparent)]',
            )}
            style={
              !prefersReduced
                ? {
                    animation: 'srCelebrationFadeUp 0.5s ease-out 0.9s both',
                  }
                : undefined
            }
          >
            {hasPr ? (
              <>
                <Trophy size={16} className="text-[var(--sr-brand-primary)]" />
                <span className="sr-text-body-sm font-semibold text-[var(--sr-brand-primary)]">
                  {pl.celebrationPrBadge}
                </span>
              </>
            ) : (
              <>
                <Trophy size={16} className="text-[var(--sr-warning)]" />
                <span className="sr-text-body-sm font-semibold text-[var(--sr-warning)]">
                  {pl.celebrationAchievementBadge}
                </span>
              </>
            )}
          </div>
        )}

        {/* Tap to dismiss hint */}
        <p
          className="mt-10 sr-text-body-sm text-[var(--sr-text-muted)]"
          style={
            !prefersReduced
              ? {
                  animation: 'srCelebrationFadeUp 0.5s ease-out 1.2s both',
                }
              : undefined
          }
        >
          {pl.celebrationTapToContinue}
        </p>
      </div>

      <style>{`
        @keyframes srCelebrationPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes srCelebrationCheck {
          from { stroke-dashoffset: 100; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes srCelebrationFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function StatCounter({
  icon: Icon,
  value,
  label,
  animate,
  delay,
}: {
  icon: typeof Flame
  value: number
  label: string
  animate: boolean
  delay: number
}) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!animate || value === 0) {
      setDisplayValue(value)
      return
    }

    const startDelay = delay * 1000
    const duration = 800
    let startTime: number | undefined

    const tick = (now: number) => {
      if (startTime === undefined) startTime = now
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(value * eased))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick)
    }, startDelay)

    return () => {
      clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [animate, value, delay])

  return (
    <div className="flex flex-col items-center">
      <Icon size={20} className="mb-1 text-[var(--sr-text-muted)]" aria-hidden />
      <p className="sr-text-h2 text-[var(--sr-text-primary)] tabular-nums">
        {displayValue}
      </p>
      <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">{label}</p>
    </div>
  )
}
