import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { pl } from '@/i18n/pl'
import { beginLevelChange, beginProgramSetup } from '@/lib/setup-flow'
import { showToast } from '@/stores/toast-store'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { ProgramIconBadge } from './ProgramIconBadge'
import type { Program } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'
import type { ResumeInfo } from '@/lib/home-summary'

export type CardBadgeVariant = 'success' | 'warning' | 'error' | 'info'

/** Card header — icon + title + status badge + ⋯ menu (with its Sheet).
 *  Na wąskich ekranach (375px) badge + menu mogą się nie zmieścić,
 *  dlatego grupa po prawej zawija się pod tytuł gdy brakuje miejsca. */
export function ProgramCardHeader({
  program,
  label,
  badge,
  cycleNameShort,
  progress,
  resume,
  showSkipRest,
  onReload,
  onPendingSetup,
  onOpenCycleMap,
}: {
  program: Program
  label: string
  badge: { label: string; variant: CardBadgeVariant }
  cycleNameShort: string | null
  progress: LocalProgramProgress
  resume: ResumeInfo | null
  showSkipRest: boolean
  onReload: () => void
  onPendingSetup: (mode: 'level' | 'retest') => void
  onOpenCycleMap: () => void | Promise<void>
}) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ProgramIconBadge program={program} />
          <div className="min-w-0 flex-1">
            <h3 className="min-w-0 break-words sr-text-h2 text-[var(--sr-text-primary)]">
              {label}
            </h3>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <button
            type="button"
            aria-label={pl.menuProgram}
            aria-haspopup="dialog"
            aria-expanded={showMenu}
            className={cn(
              'flex min-h-12 min-w-12 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
              FOCUS_RING,
            )}
            onClick={() => setShowMenu(true)}
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* Cycle name — subtle subtitle below title */}
      {cycleNameShort && (
        <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {cycleNameShort}
        </p>
      )}

      <Sheet open={showMenu} onClose={() => setShowMenu(false)} title={pl.menuProgram}>
        <div className="flex flex-col gap-1 pb-2">
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              if (resume) onPendingSetup('level')
              else void beginLevelChange(navigate, program)
            }}
          >
            {pl.menuChangeLevel}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              navigate(`/plans?tab=programs&highlight=${progress.cycleId}`)
            }}
          >
            {pl.menuFullCycle}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              void onOpenCycleMap()
            }}
          >
            {pl.menuCycleMap}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              navigate('/progress?tab=history')
            }}
          >
            {pl.menuHistory}
          </Button>
          {showSkipRest && (
            <Button
              variant="ghost"
              fullWidth
              className="justify-start px-3"
              onClick={() => {
                setShowMenu(false)
                void (async () => {
                  const { skipRestDay } = await import('@/lib/program-service')
                  await skipRestDay(program)
                  onReload()
                  showToast(pl.restDaySkipped, 'success')
                })()
              }}
            >
              {pl.menuSkipRest}
            </Button>
          )}
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              if (resume) onPendingSetup('retest')
              else void beginProgramSetup(navigate, program, { retest: true })
            }}
          >
            {pl.menuRetest}
          </Button>
        </div>
      </Sheet>
    </>
  )
}
