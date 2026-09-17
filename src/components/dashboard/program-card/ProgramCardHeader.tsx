import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { pl } from '@/i18n/pl'
import { beginLevelChange, beginProgramSetup } from '@/lib/setup-flow'
import { showToast } from '@/stores/toast-store'
import { ProgramIconBadge } from './ProgramIconBadge'
import { HomeCardHeader } from './HomeCardHeader'
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
      <HomeCardHeader
        icon={<ProgramIconBadge program={program} />}
        title={label}
        badge={badge}
        menuLabel={pl.menuProgram}
        menuExpanded={showMenu}
        onMenu={() => setShowMenu(true)}
      />

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
