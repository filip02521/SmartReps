import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, Badge } from '@/components/ui/Card'
import { SetupStepper } from '@/components/setup/SetupStepper'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { selectCycleByTest, isHigherCycle, isLowerCycle, getRetestOptions } from '@/lib/cycle-selector'
import { getNextWorkoutDate, getTestBlockDays } from '@/lib/progress-engine'
import { getCyclesByProgram } from '@/data/plans'
import { initProgramProgress, updateProgramProgress, getProgramProgress } from '@/lib/program-service'
import { db } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { Sheet } from '@/components/ui/Sheet'
import { getCelebrationBadge, formatSetTarget } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'

export default function CyclePicker() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const [searchParams] = useSearchParams()
  const isRetest = searchParams.get('retest') === '1'
  const { pendingTest, pendingStart, clearPendingTest, setPendingStart } = useAppStore()
  const navigate = useNavigate()
  const hydrated = useStoreHydrated()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [showAllCycles, setShowAllCycles] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [currentCycleId, setCurrentCycleId] = useState<string | null>(null)

  useEffect(() => {
    if (isRetest) {
      getProgramProgress(program).then((p) => setCurrentCycleId(p?.cycleId ?? null))
    }
  }, [isRetest, program])

  const [fullCycleId, setFullCycleId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const advancingRef = useRef(false)

  useEffect(() => {
    if (isRetest && currentCycleId && pendingTest) {
      const opts = getRetestOptions(program, pendingTest.reps, currentCycleId)
      setSelectedId(opts.recommended.id)
    }
  }, [isRetest, currentCycleId, program, pendingTest])

  useEffect(() => {
    if (!hydrated || advancingRef.current || submitLock.current) return
    // Confirm just wrote pendingStart — don't bounce back to MaxTest
    if (pendingStart?.program === program) {
      navigate(`/setup/start/${program}${isRetest ? '?retest=1' : ''}`, { replace: true })
      return
    }
    if (!pendingTest || pendingTest.program !== program) {
      navigate(`/setup/test/${program}${isRetest ? '?retest=1' : ''}`, { replace: true })
    }
  }, [hydrated, pendingTest, pendingStart, program, isRetest, navigate])

  if (!hydrated || (!pendingTest && pendingStart?.program !== program) || (pendingTest && pendingTest.program !== program)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.restoringSetup} />
      </div>
    )
  }

  // Advancing to ProgramStart — show loader while navigate settles
  if (!pendingTest && pendingStart?.program === program) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader compact />
      </div>
    )
  }

  if (!pendingTest) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.restoringSetup} />
      </div>
    )
  }

  const recommended = selectCycleByTest(program, pendingTest.reps)
  const cycles = getCyclesByProgram(program)
  const selected = cycles.find((c) => c.id === (selectedId ?? recommended.id)) ?? recommended
  const celebration = getCelebrationBadge(program, pendingTest.reps)
  const visibleCycles = showAllCycles
    ? cycles
    : [recommended, ...cycles.filter((c) => c.id !== recommended.id && c.level <= recommended.level + 1)].slice(0, 4)

  const retestOptions =
    isRetest && currentCycleId ? getRetestOptions(program, pendingTest.reps, currentCycleId) : null

  const confirm = async () => {
    if (submitLock.current || submitting) return
    submitLock.current = true
    setSubmitting(true)
    try {
      await initProgramProgress(program, selected.id)
      const existing = await getProgramProgress(program)
      const isRepeat = isRetest && selected.id === currentCycleId
      const restUntil = getNextWorkoutDate(new Date(), getTestBlockDays())

      await updateProgramProgress(program, {
        cycleId: selected.id,
        status: 'rest',
        currentDay: 1,
        cycleAttempt: isRepeat ? (existing?.cycleAttempt ?? 0) + 1 : 1,
        nextWorkoutAfter: restUntil.toISOString(),
        lastWorkoutAt: new Date().toISOString(),
      })

      const existingTest =
        pendingTest.committedMaxTestId != null
          ? await db.maxTests.get(pendingTest.committedMaxTestId)
          : undefined

      const testRecord = {
        program,
        reps: pendingTest.reps,
        testedAt: existingTest?.testedAt ?? new Date().toISOString(),
        selectedCycleId: selected.id,
        wasManualOverride: selected.id !== recommended.id,
      }

      let testId = pendingTest.committedMaxTestId
      if (testId != null && existingTest) {
        await db.maxTests.update(testId, testRecord)
        await enqueueSync('max_tests', 'update', { ...testRecord, id: testId })
      } else {
        testId = await db.maxTests.add(testRecord)
        await enqueueSync('max_tests', 'insert', { ...testRecord, id: testId })
      }

      advancingRef.current = true
      // Set next gate first so the redirect effect never bounces to MaxTest
      setPendingStart({
        program,
        cycleId: selected.id,
        cycleName: selected.nameShort,
        reps: pendingTest.reps,
        isRetest,
        celebration: celebration ?? undefined,
        committedMaxTestId: testId,
      })
      clearPendingTest()
      navigate(`/setup/start/${program}${isRetest ? '?retest=1' : ''}`, { replace: true })
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  const handleStart = () => {
    if (submitLock.current || submitting) return
    if (isHigherCycle(selected, recommended)) {
      setShowWarning(true)
      return
    }
    void confirm()
  }

  const showRepeatPowyzej40 =
    isRetest &&
    currentCycleId === 'pullups-powyzej-40' &&
    pendingTest.reps < 50

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      {!isRetest && <SetupStepper current="cycle" />}
      <PageHeader
        title={isRetest ? pl.retestTitle : pl.pickLevel}
        subtitle={pl.testResultSubtitle(
          pendingTest.reps,
          program === 'pushups' ? pl.pushups : pl.pullups,
        )}
      />

      {celebration && <Badge variant="success">{celebration}</Badge>}

      {isRetest && retestOptions && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSelectedId(retestOptions.recommended.id)}>
            {pl.retestRecommend(retestOptions.recommended.nameShort)}
          </Button>
          {currentCycleId && retestOptions.alternatives.some((c) => c.id === currentCycleId) && (
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(currentCycleId)}>
              {pl.repeatCycle}
            </Button>
          )}
          {showRepeatPowyzej40 && (
            <Button size="sm" variant="ghost" onClick={() => setSelectedId('pullups-powyzej-40')}>
              {pl.repeatPowyzej40}
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {visibleCycles.map((cycle) => (
          <CycleCard
            key={cycle.id}
            cycle={cycle}
            recommended={recommended}
            selectedId={selectedId ?? recommended.id}
            previewId={previewId}
            onSelect={() => setSelectedId(cycle.id)}
            onTogglePreview={() => setPreviewId(previewId === cycle.id ? null : cycle.id)}
            onShowFullCycle={() => setFullCycleId(cycle.id)}
          />
        ))}
      </div>

      {fullCycleId && (() => {
        const fc = cycles.find((c) => c.id === fullCycleId)
        if (!fc) return null
        return (
          <FullCycleSheet cycle={fc} onClose={() => setFullCycleId(null)} />
        )
      })()}

      <Button variant="ghost" className="mt-3" fullWidth onClick={() => setShowAllCycles((v) => !v)}>
        {showAllCycles ? pl.hideOtherCycles : pl.showAllCycles}
      </Button>

      {showWarning && (
        <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-warning)] bg-[rgba(251,191,36,0.1)] p-4 text-sm">
          {pl.higherLevelWarning}
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowWarning(false); setSelectedId(recommended.id) }}>
              {pl.backToRecommended}
            </Button>
            <Button variant="danger" size="sm" disabled={submitting} onClick={() => void confirm()}>{pl.understandHigher}</Button>
          </div>
        </div>
      )}

      <Button className="mt-6" fullWidth disabled={submitting} onClick={handleStart}>
        {pl.pickLevelCta} — {selected.nameShort}
      </Button>
    </div>
  )
}

function CycleCard({
  cycle,
  recommended,
  selectedId,
  previewId,
  onSelect,
  onTogglePreview,
  onShowFullCycle,
}: {
  cycle: import('@/data/plans/types').Cycle
  recommended: import('@/data/plans/types').Cycle
  selectedId: string
  previewId: string | null
  onSelect: () => void
  onTogglePreview: () => void
  onShowFullCycle: () => void
}) {
  const isRec = cycle.id === recommended.id
  const isSel = cycle.id === selectedId
  const isLower = isLowerCycle(cycle, recommended)

  return (
    <Card
      className="cursor-pointer sr-card transition-colors"
      style={{ outline: isSel ? '2px solid var(--sr-brand-primary)' : isRec ? '1px solid var(--sr-brand-primary-muted)' : undefined }}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div>
          {isRec && <Badge className="mb-2">{pl.recommended}</Badge>}
          {isLower && !isRec && <Badge variant="success" className="mb-2">{pl.saferStart}</Badge>}
          <p className="font-semibold">{cycle.nameShort}</p>
          <p className="text-sm text-[var(--sr-text-secondary)]">
            {cycle.days.length} dni · {cycle.description}
          </p>
        </div>
        {isSel && <span className="text-[var(--sr-brand-primary)]"><ChevronRight size={20} /></span>}
      </div>
      <button
        type="button"
        className="mt-2 flex items-center gap-1 text-xs text-[var(--sr-brand-primary)]"
        onClick={(e) => { e.stopPropagation(); onTogglePreview() }}
      >
        {previewId === cycle.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {pl.previewDay1}
      </button>
      {previewId === cycle.id && cycle.days[0] && (
        <div className="mt-2 border-t border-[var(--sr-border-subtle)] pt-2 text-xs text-[var(--sr-text-secondary)]">
          <p className="mb-1">{pl.restSecAndSets(cycle.days[0].restBetweenSetsSec)}</p>
          <p>{cycle.days[0].sets.map((s) => formatSetTarget(s)).join(' · ')}</p>
          <button
            type="button"
            className="mt-2 text-[var(--sr-brand-primary)] underline"
            onClick={(e) => { e.stopPropagation(); onShowFullCycle() }}
          >
            {pl.previewFullCycle}
          </button>
        </div>
      )}
    </Card>
  )
}

function FullCycleSheet({
  cycle,
  onClose,
}: {
  cycle: import('@/data/plans/types').Cycle
  onClose: () => void
}) {
  return (
    <Sheet open onClose={onClose} title={`${pl.previewFullCycle} — ${cycle.nameShort}`}>
      <div className="space-y-4">
        {cycle.days.map((day) => (
          <div key={day.dayNumber} className="border-t border-[var(--sr-border-subtle)] pt-3">
            <p className="text-sm font-medium">{pl.dayLabel(day.dayNumber)} · {pl.restBetweenSets(day.restBetweenSetsSec)}</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--sr-text-secondary)]">
              {day.sets.map((s, i) => (
                <li key={i} className="flex justify-between">
                  <span>{pl.setColumn} {i + 1}</span>
                  <span>{formatSetTarget(s)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
