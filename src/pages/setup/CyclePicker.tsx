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
import { getNextWorkoutDate, getTestBlockDays, isWorkoutAvailable } from '@/lib/progress-engine'
import { getCyclesByProgram } from '@/data/plans'
import { initProgramProgress, updateProgramProgress, getProgramProgress } from '@/lib/program-service'
import {
  applyLevelChange,
  getLevelChangeVisibleCycles,
  loadLevelChangeContext,
} from '@/lib/level-change'
import { beginProgramSetup } from '@/lib/setup-flow'
import { db } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { Sheet } from '@/components/ui/Sheet'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { getCelebrationBadge } from '@/lib/progress-engine'
import type { Cycle, Program } from '@/data/plans/types'

export default function CyclePicker() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const [searchParams] = useSearchParams()
  const isRetest = searchParams.get('retest') === '1'
  const isLevelChange = searchParams.get('change') === '1'
  const { pendingTest, pendingStart, clearPendingTest, setPendingStart } = useAppStore()
  const navigate = useNavigate()
  const hydrated = useStoreHydrated()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [showAllCycles, setShowAllCycles] = useState(isLevelChange)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [currentCycleId, setCurrentCycleId] = useState<string | null>(null)
  const [restBlocked, setRestBlocked] = useState<string | null>(null)
  const [changeReady, setChangeReady] = useState(false)
  const [warningBaseline, setWarningBaseline] = useState<Cycle | null>(null)
  const [lastTestReps, setLastTestReps] = useState<number | null>(null)

  const [fullCycleId, setFullCycleId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const advancingRef = useRef(false)

  const startQuery = isRetest ? '?retest=1' : isLevelChange ? '?change=1' : ''

  useEffect(() => {
    if (isRetest || isLevelChange) {
      void getProgramProgress(program).then((p) => setCurrentCycleId(p?.cycleId ?? null))
    }
  }, [isRetest, isLevelChange, program])

  useEffect(() => {
    if (!isLevelChange || !hydrated) return
    let cancelled = false
    setChangeReady(false)
    void (async () => {
      const ctx = await loadLevelChangeContext(program)
      if (cancelled) return
      if (!ctx) {
        navigate(`/setup/test/${program}`, { replace: true })
        return
      }
      setCurrentCycleId(ctx.currentCycle.id)
      setSelectedId(ctx.currentCycle.id)
      setWarningBaseline(ctx.warningBaseline)
      setLastTestReps(ctx.lastTestReps)
      setChangeReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [isLevelChange, hydrated, program, navigate])

  useEffect(() => {
    if (isRetest && currentCycleId && pendingTest) {
      const opts = getRetestOptions(program, pendingTest.reps, currentCycleId)
      setSelectedId(opts.recommended.id)
    }
  }, [isRetest, currentCycleId, program, pendingTest])

  useEffect(() => {
    if (!hydrated || advancingRef.current || submitLock.current) return
    if (pendingStart?.program === program) {
      navigate(`/setup/start/${program}${startQuery}`, { replace: true })
      return
    }
    if (isLevelChange) return
    if (!pendingTest || pendingTest.program !== program) {
      navigate(`/setup/test/${program}${isRetest ? '?retest=1' : ''}`, { replace: true })
    }
  }, [hydrated, pendingTest, pendingStart, program, isRetest, isLevelChange, navigate, startQuery])

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.restoringSetup} />
      </div>
    )
  }

  if (pendingStart?.program === program) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader compact />
      </div>
    )
  }

  if (isLevelChange) {
    if (!changeReady || !currentCycleId || !warningBaseline) {
      return (
        <div className="mx-auto max-w-lg px-4 py-8 safe-top">
          <PageLoader message={pl.restoringSetup} />
        </div>
      )
    }
    return (
      <LevelChangePicker
        program={program}
        currentCycleId={currentCycleId}
        selectedId={selectedId ?? currentCycleId}
        warningBaseline={warningBaseline}
        lastTestReps={lastTestReps}
        showAllCycles={showAllCycles}
        previewId={previewId}
        fullCycleId={fullCycleId}
        submitting={submitting}
        showWarning={showWarning}
        onSelect={setSelectedId}
        onTogglePreview={(id) => setPreviewId(previewId === id ? null : id)}
        onShowFullCycle={setFullCycleId}
        onCloseFullCycle={() => setFullCycleId(null)}
        onToggleShowAll={() => setShowAllCycles((v) => !v)}
        onShowWarning={() => setShowWarning(true)}
        onHideWarning={() => setShowWarning(false)}
        onResetToBaseline={() => {
          setShowWarning(false)
          setSelectedId(warningBaseline.id)
        }}
        onPreferTest={() => void beginProgramSetup(navigate, program, { retest: true })}
        onConfirm={async () => {
          if (submitLock.current || submitting) return
          submitLock.current = true
          setSubmitting(true)
          try {
            const selected =
              getCyclesByProgram(program).find((c) => c.id === (selectedId ?? currentCycleId)) ??
              warningBaseline
            const result = await applyLevelChange(program, selected.id)
            advancingRef.current = true
            clearPendingTest()
            setPendingStart({
              program,
              cycleId: result.cycle.id,
              cycleName: result.cycle.nameShort,
              reps: lastTestReps ?? 0,
              isLevelChange: true,
              isRetest: false,
            })
            navigate(`/setup/start/${program}?change=1`, { replace: true })
          } finally {
            submitLock.current = false
            setSubmitting(false)
          }
        }}
      />
    )
  }

  if (!pendingTest || pendingTest.program !== program) {
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
    setRestBlocked(null)
    try {
      const existing = await getProgramProgress(program)
      if (
        (isRetest || existing?.status === 'test_pending') &&
        existing?.nextWorkoutAfter &&
        !isWorkoutAvailable(new Date(existing.nextWorkoutAfter))
      ) {
        setRestBlocked(pl.testBlockedRest)
        return
      }

      await initProgramProgress(program, selected.id)
      const afterInit = await getProgramProgress(program)
      const isRepeat = isRetest && selected.id === currentCycleId
      const applyPostTestRest = isRetest || existing?.status === 'test_pending' || !!existing?.lastWorkoutAt
      const restUntil = getNextWorkoutDate(new Date(), getTestBlockDays())

      await updateProgramProgress(program, {
        cycleId: selected.id,
        status: applyPostTestRest ? 'rest' : 'active',
        currentDay: 1,
        cycleAttempt: isRepeat ? (afterInit?.cycleAttempt ?? 0) + 1 : 1,
        nextWorkoutAfter: applyPostTestRest ? restUntil.toISOString() : null,
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

      const { scheduleAchievementCheck } = await import('@/lib/achievements/schedule')
      scheduleAchievementCheck()

      advancingRef.current = true
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

      {restBlocked && (
        <p className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-warning)]/15 p-3 text-sm text-[var(--sr-warning)]">
          {restBlocked}
        </p>
      )}

      {!isRetest && (
        <p className="mt-3 text-sm text-[var(--sr-text-secondary)]">{pl.firstTestReadyHint}</p>
      )}
      {isRetest && (
        <p className="mt-3 text-sm text-[var(--sr-text-secondary)]">{pl.postTestRest}</p>
      )}

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
            currentCycleId={null}
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
        return <FullCycleSheet cycle={fc} onClose={() => setFullCycleId(null)} />
      })()}

      <Button variant="ghost" className="mt-3" fullWidth onClick={() => setShowAllCycles((v) => !v)}>
        {showAllCycles ? pl.hideOtherCycles : pl.showAllCycles}
      </Button>

      {showWarning && (
        <ConfirmSheet
          title={pl.higherLevelWarningTitle}
          message={pl.higherLevelWarning}
          confirmLabel={pl.understandHigher}
          cancelLabel={pl.backToRecommended}
          variant="danger"
          onConfirm={() => void confirm()}
          onCancel={() => {
            setShowWarning(false)
            setSelectedId(recommended.id)
          }}
        />
      )}

      <Button className="mt-6" fullWidth disabled={submitting} onClick={handleStart}>
        {pl.pickLevelCta} — {selected.nameShort}
      </Button>
    </div>
  )
}

function LevelChangePicker({
  program,
  currentCycleId,
  selectedId,
  warningBaseline,
  lastTestReps,
  showAllCycles,
  previewId,
  fullCycleId,
  submitting,
  showWarning,
  onSelect,
  onTogglePreview,
  onShowFullCycle,
  onCloseFullCycle,
  onToggleShowAll,
  onShowWarning,
  onHideWarning,
  onResetToBaseline,
  onPreferTest,
  onConfirm,
}: {
  program: Program
  currentCycleId: string
  selectedId: string
  warningBaseline: Cycle
  lastTestReps: number | null
  showAllCycles: boolean
  previewId: string | null
  fullCycleId: string | null
  submitting: boolean
  showWarning: boolean
  onSelect: (id: string) => void
  onTogglePreview: (id: string) => void
  onShowFullCycle: (id: string) => void
  onCloseFullCycle: () => void
  onToggleShowAll: () => void
  onShowWarning: () => void
  onHideWarning: () => void
  onResetToBaseline: () => void
  onPreferTest: () => void
  onConfirm: () => Promise<void>
}) {
  const cycles = getCyclesByProgram(program)
  const visible = getLevelChangeVisibleCycles(program, currentCycleId, showAllCycles)
  const selected = cycles.find((c) => c.id === selectedId) ?? warningBaseline
  const sameAsCurrent = selected.id === currentCycleId

  const handleStart = () => {
    if (submitting) return
    if (isHigherCycle(selected, warningBaseline)) {
      onShowWarning()
      return
    }
    void onConfirm()
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <PageHeader
        title={pl.levelChangeTitle}
        subtitle={pl.levelChangeSubtitle}
      />

      <p className="mt-3 text-sm text-[var(--sr-text-secondary)]">{pl.levelChangeHint}</p>

      {lastTestReps != null && (
        <p className="mt-2 text-xs text-[var(--sr-text-muted)]">
          {pl.levelChangeLastTest(
            lastTestReps,
            program === 'pushups' ? pl.pushups : pl.pullups,
            warningBaseline.nameShort,
          )}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {visible.map((cycle) => (
          <CycleCard
            key={cycle.id}
            cycle={cycle}
            recommended={warningBaseline}
            selectedId={selectedId}
            currentCycleId={currentCycleId}
            previewId={previewId}
            onSelect={() => onSelect(cycle.id)}
            onTogglePreview={() => onTogglePreview(cycle.id)}
            onShowFullCycle={() => onShowFullCycle(cycle.id)}
          />
        ))}
      </div>

      {fullCycleId && (() => {
        const fc = cycles.find((c) => c.id === fullCycleId)
        if (!fc) return null
        return <FullCycleSheet cycle={fc} onClose={onCloseFullCycle} />
      })()}

      <Button variant="ghost" className="mt-3" fullWidth onClick={onToggleShowAll}>
        {showAllCycles ? pl.hideOtherCycles : pl.showAllCycles}
      </Button>

      {showWarning && (
        <ConfirmSheet
          title={pl.higherLevelWarningTitle}
          message={pl.higherLevelWarning}
          confirmLabel={pl.understandHigher}
          cancelLabel={pl.backToRecommended}
          variant="danger"
          onConfirm={() => {
            onHideWarning()
            void onConfirm()
          }}
          onCancel={onResetToBaseline}
        />
      )}

      <Button className="mt-6" fullWidth disabled={submitting} onClick={handleStart}>
        {sameAsCurrent
          ? `${pl.levelChangeRestart} — ${selected.nameShort}`
          : `${pl.pickLevelCta} — ${selected.nameShort}`}
      </Button>

      <Button variant="ghost" className="mt-2" fullWidth disabled={submitting} onClick={onPreferTest}>
        {pl.levelChangeDoTest}
      </Button>
    </div>
  )
}

function CycleCard({
  cycle,
  recommended,
  selectedId,
  currentCycleId,
  previewId,
  onSelect,
  onTogglePreview,
  onShowFullCycle,
}: {
  cycle: import('@/data/plans/types').Cycle
  recommended: import('@/data/plans/types').Cycle
  selectedId: string
  currentCycleId: string | null
  previewId: string | null
  onSelect: () => void
  onTogglePreview: () => void
  onShowFullCycle: () => void
}) {
  const isRec = cycle.id === recommended.id
  const isSel = cycle.id === selectedId
  const isCurrent = currentCycleId != null && cycle.id === currentCycleId
  const isLower = isLowerCycle(cycle, recommended)

  return (
    <Card
      className="cursor-pointer sr-card transition-colors"
      style={{ outline: isSel ? '2px solid var(--sr-brand-primary)' : isRec ? '1px solid var(--sr-brand-primary-muted)' : undefined }}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div>
          {isCurrent && <Badge className="mb-2" variant="success">{pl.levelChangeCurrent}</Badge>}
          {isRec && !isCurrent && <Badge className="mb-2">{pl.recommended}</Badge>}
          {isLower && !isRec && !isCurrent && <Badge variant="success" className="mb-2">{pl.saferStart}</Badge>}
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
        <div className="mt-2 border-t border-[var(--sr-border-subtle)] pt-2">
          <p className="mb-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.restSecAndSets(cycle.days[0].restBetweenSetsSec)}
          </p>
          <SetTargetsRow sets={cycle.days[0].sets} size="sm" />
          <button
            type="button"
            className="mt-2 text-sm text-[var(--sr-brand-primary)] underline"
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
  cycle: Cycle
  onClose: () => void
}) {
  return (
    <Sheet open onClose={onClose} title={`${pl.previewFullCycle} — ${cycle.nameShort}`}>
      <div className="space-y-4">
        {cycle.days.map((day) => (
          <div key={day.dayNumber} className="border-t border-[var(--sr-border-subtle)] pt-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-[var(--sr-text-primary)]">
                {pl.dayLabel(day.dayNumber)}
              </p>
              <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.restBetweenSets(day.restBetweenSetsSec)}
              </p>
            </div>
            <SetTargetsRow sets={day.sets} size="sm" />
          </div>
        ))}
      </div>
    </Sheet>
  )
}
