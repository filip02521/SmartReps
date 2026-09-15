import { Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import type { ProgramBucket, ResumeInfo } from '@/lib/home-summary'

export type CardCtaHandlers = {
  /** Continue the in-progress session (stale variants confirm first). */
  onResume: () => void
  /** Abandon the stale in-progress session and stay on dashboard. */
  onStartFresh: () => void
  /** Resume is possible but the program is resting — confirm abandon+train. */
  onTrainAnywayIntent: () => void
  /** Unpause the program. */
  onResumeProgram: () => void
  onRetestNow: () => void
  onChangeLevel: () => void
  /** resting → user wants to train anyway (reveals the start CTA). */
  onTrainDespiteRest: () => void
  onCancelDespiteRest: () => void
  /** Preview-or-start for the current day. */
  onStartDay: () => void
  /** Scroll to the pushups card (cross-training suggestion). */
  onCrossTrain: () => void
}

/** CTA footer — one bordered-off region, five mutually exclusive variants. */
export function ProgramCardCta({
  bucket,
  hasResume,
  resume,
  resting,
  trainDespiteRest,
  showCrossTrain,
  busy,
  currentDay,
  handlers,
}: {
  bucket: ProgramBucket
  hasResume: boolean
  resume: ResumeInfo | null
  resting: boolean
  trainDespiteRest: boolean
  showCrossTrain: boolean
  busy: boolean
  currentDay: number
  handlers: CardCtaHandlers
}) {
  return (
    <div className="mt-4 border-t border-[var(--sr-border-subtle)] pt-4">
      {hasResume && resume && (
        <div className="flex flex-col gap-2">
          <Button
            size="touch"
            fullWidth
            disabled={busy}
            className="sr-pulse-cta"
            onClick={handlers.onResume}
          >
            <span className="flex items-center justify-center gap-2">
              <Play size={18} className="fill-current" />
              {pl.continueWorkout(resume.day, resume.set, resume.total)}
            </span>
          </Button>
          {resume.stale && !resting && (
            <Button
              variant="ghost"
              fullWidth
              disabled={busy}
              onClick={handlers.onStartFresh}
            >
              {pl.startFresh}
            </Button>
          )}
          {!resume.stale && resting && (
            <Button
              variant="ghost"
              fullWidth
              disabled={busy}
              onClick={handlers.onTrainAnywayIntent}
            >
              {pl.trainAnywayNew}
            </Button>
          )}
        </div>
      )}

      {!hasResume && bucket === 'paused' && (
        <Button size="touch" fullWidth onClick={handlers.onResumeProgram}>
          {pl.resumeProgram}
        </Button>
      )}

      {!hasResume && bucket === 'test_pending_ready' && (
        <div className="flex flex-col gap-2">
          <Button size="touch" fullWidth onClick={handlers.onRetestNow}>
            {pl.retestNow}
          </Button>
          <Button variant="secondary" fullWidth onClick={handlers.onChangeLevel}>
            {pl.menuChangeLevel}
          </Button>
        </div>
      )}

      {!hasResume && bucket === 'test_pending_rest' && (
        <Button
          variant="secondary"
          size="touch"
          fullWidth
          onClick={handlers.onChangeLevel}
        >
          {pl.menuChangeLevel}
        </Button>
      )}

      {!hasResume && (bucket === 'resting' || bucket === 'ready') && (
        <div className="flex flex-col gap-2">
          {showCrossTrain && !trainDespiteRest && (
            <Button
              variant="secondary"
              size="touch"
              fullWidth
              onClick={handlers.onCrossTrain}
            >
              {pl.crossTrainingCta}
            </Button>
          )}
          {bucket === 'resting' && !trainDespiteRest ? (
            <Button
              variant="ghost"
              size="touch"
              fullWidth
              onClick={handlers.onTrainDespiteRest}
            >
              {pl.trainAnyway}
            </Button>
          ) : (
            <Button size="touch" fullWidth onClick={handlers.onStartDay}>
              {pl.startDay(currentDay)}
            </Button>
          )}
          {bucket === 'resting' && trainDespiteRest && (
            <Button variant="ghost" fullWidth onClick={handlers.onCancelDespiteRest}>
              {pl.cancel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
