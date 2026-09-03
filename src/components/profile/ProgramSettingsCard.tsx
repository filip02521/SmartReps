import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { NestedStat } from '@/components/ui/NestedStat'
import { ProgramAccentCard } from '@/components/ui/ProgramAccentCard'
import { Sheet } from '@/components/ui/Sheet'
import { pl } from '@/i18n/pl'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'
import { getCycleById } from '@/data/plans'
import { getStatusLabel, getStatusTone } from '@/lib/program-service'
import type { LocalProgramProgress } from '@/lib/db'
import type { Program } from '@/data/plans/types'

export function ProgramSettingsCard({
  program,
  progress,
  canDisable,
  onSetupOnTraining,
  onChangeLevel,
  onRetest,
  onTogglePause,
  onDisable,
}: {
  program: Program
  progress?: LocalProgramProgress
  canDisable: boolean
  onSetupOnTraining: () => void
  onChangeLevel: () => void
  onRetest: () => void
  onTogglePause: () => void
  onDisable: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const label = program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram
  const cycle = progress ? getCycleById(progress.cycleId) : undefined
  const paused = progress?.status === 'paused'
  const configured = !!progress
  const statusLabel = progress ? getStatusLabel(progress) : pl.notConfigured
  const statusTone = progress ? getStatusTone(progress) : 'info'
  const badgeVariant =
    statusTone === 'success'
      ? 'success'
      : statusTone === 'warning'
        ? 'warning'
        : statusTone === 'error'
          ? 'error'
          : 'info'

  const cycleHint =
    progress && progress.cycleAttempt > 1 ? pl.attemptLabel(progress.cycleAttempt) : undefined

  const closeThen = (fn: () => void) => {
    setShowMenu(false)
    fn()
  }

  return (
    <ProgramAccentCard program={program} aria-labelledby={`program-settings-${program}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3
              id={`program-settings-${program}`}
              className="min-w-0 flex-1 sr-text-h3 text-[var(--sr-text-primary)]"
              title={label}
            >
              {label}
            </h3>
            <Badge variant={badgeVariant}>{statusLabel}</Badge>
          </div>

          {progress && cycle ? (
            <NestedStat
              className="mt-3"
              size="md"
              overline={cycle.nameShort}
              value={pl.dayOfTotal(progress.currentDay, cycle.days.length)}
              hint={cycleHint}
            />
          ) : !configured ? (
            <p className="mt-2 text-pretty sr-text-body-sm leading-snug text-[var(--sr-text-secondary)]">
              {pl.profileUnconfiguredHint}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className={cn(
            'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-elevated)] hover:text-[var(--sr-text-primary)] active:scale-95',
            FOCUS_RING,
          )}
          aria-label={pl.menuProgram}
          aria-expanded={showMenu}
          onClick={() => setShowMenu(true)}
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {!configured && (
        <Button
          variant="secondary"
          size="md"
          fullWidth
          className="mt-4 justify-start px-4"
          onClick={onSetupOnTraining}
        >
          {pl.profileSetupOnTraining}
        </Button>
      )}

      <Sheet open={showMenu} onClose={() => setShowMenu(false)} title={label} showClose>
        <div className="flex flex-col gap-2.5">
          {configured && (
            <>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                className="justify-start px-4"
                onClick={() => closeThen(onChangeLevel)}
              >
                {pl.menuChangeLevel}
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                className="justify-start px-4"
                onClick={() => closeThen(onRetest)}
              >
                {pl.menuRetest}
              </Button>
              <Button
                variant="ghost"
                size="md"
                fullWidth
                className="justify-start px-4 text-[var(--sr-text-secondary)]"
                onClick={() => closeThen(onTogglePause)}
              >
                {paused ? pl.resumeProgram : pl.pauseProgram}
              </Button>
            </>
          )}
          {canDisable && (
            <div className={cn(configured && 'border-t border-[var(--sr-border-subtle)] pt-2')}>
              <Button
                variant="ghost"
                size="md"
                fullWidth
                className="justify-start px-4 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
                onClick={() => closeThen(onDisable)}
              >
                {pl.disableProgram}
              </Button>
            </div>
          )}
        </div>
      </Sheet>
    </ProgramAccentCard>
  )
}
