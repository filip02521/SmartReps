import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Dumbbell, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import { reconcileActiveWorkout } from '@/lib/program-service'
import { getCustomPlanResumeInfo } from '@/lib/custom-plan-resume'
import { isStaleActiveWorkout } from '@/lib/sync'
import { resolveBuiltin, getDayPlan } from '@/lib/plan-resolver'
import { Z_SHEET } from '@/lib/ui-chrome'
import type { Program } from '@/data/plans/types'

type ResumeTarget =
  | { kind: 'builtin'; program: Program; day: number; set: number; total: number; stale: boolean }
  | { kind: 'custom'; planId: string; planName: string; day: number; set: number; total: number; stale: boolean }

const DISMISS_KEY = 'resume-prompt-dismissed-at'

/** Show a non-blocking prompt when an unfinished workout is detected at app open. */
export function ResumeWorkoutPrompt() {
  const [target, setTarget] = useState<ResumeTarget | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Don't show on workout pages — user is already in the workout flow
    if (location.pathname.startsWith('/workout/')) return

    let cancelled = false
    void (async () => {
      // Don't show if dismissed recently (within 6h)
      // Wrapped in try/catch — localStorage can throw in private browsing
      try {
        const dismissedAt = localStorage.getItem(DISMISS_KEY)
        if (dismissedAt) {
          const age = Date.now() - parseInt(dismissedAt, 10)
          if (age < 6 * 60 * 60 * 1000) return
        }
      } catch {
        // localStorage unavailable — proceed without dismiss check
      }

      // Check builtin programs
      const programs: Program[] = ['pushups', 'pullups']
      for (const program of programs) {
        const active = await reconcileActiveWorkout(program)
        if (!active) continue
        const session = await db.workoutSessions.get(active.sessionId)
        if (!session || session.status !== 'in_progress') continue
        if (active.setResults.length === 0 && (session.setResults?.length ?? 0) === 0) continue
        if (cancelled) return
        // Use planned set count from the day plan, not completed count
        const ctx = resolveBuiltin(program, session.cycleId)
        const dayPlan = ctx ? getDayPlan(ctx, session.dayNumber) : null
        const plannedTotal = dayPlan?.exercises[0]?.sets.length ?? 0
        setTarget({
          kind: 'builtin',
          program,
          day: session.dayNumber,
          set: active.currentSetIndex + 1,
          total: plannedTotal || active.setResults.length || 1,
          stale: isStaleActiveWorkout(active.updatedAt),
        })
        return
      }

      // Check custom plans
      const customPlans = await db.customPlans.toArray()
      for (const plan of customPlans) {
        const info = await getCustomPlanResumeInfo(plan.id)
        if (!info) continue
        if (cancelled) return
        setTarget({
          kind: 'custom',
          planId: plan.id,
          planName: plan.name,
          day: info.day,
          set: info.set,
          total: info.totalSets,
          stale: info.stale,
        })
        return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (!target) return null

  const body =
    target.kind === 'builtin'
      ? pl.resumePromptBodyBuiltin(target.day, target.set, target.total)
      : pl.resumePromptBodyCustom(target.planName, target.day)

  const onResume = () => {
    if (target.kind === 'builtin') {
      navigate(`/workout/${target.program}`)
    } else {
      navigate(`/workout/custom/${target.planId}`)
    }
  }

  const onDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString())
    } catch {
      // localStorage unavailable — dismiss for this session only
    }
    setTarget(null)
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-[var(--sr-bg-overlay)]"
      style={{ zIndex: Z_SHEET + 10 }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={pl.resumePromptTitle}
        className={cn(
          'w-full max-w-lg rounded-t-[var(--sr-radius-xl)] bg-[var(--sr-bg-elevated)] animate-sheet-in',
          'px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]">
              <Dumbbell size={20} />
            </span>
            <div>
              <p className="text-base font-semibold text-[var(--sr-text-primary)]">
                {pl.resumePromptTitle}
              </p>
              <p className="mt-0.5 text-sm text-[var(--sr-text-secondary)]">{body}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={pl.resumePromptSkip}
            className="shrink-0 rounded-full p-1.5 text-[var(--sr-text-muted)] hover:bg-[var(--sr-bg-surface)]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onResume}
            className="flex-1 rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary)] px-4 py-3 text-center text-sm font-semibold text-white active:scale-[0.99]"
          >
            {pl.resumePromptResume}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-center text-sm font-semibold text-[var(--sr-text-secondary)] active:scale-[0.99]"
          >
            {pl.resumePromptSkip}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
