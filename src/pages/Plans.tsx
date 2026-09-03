import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { allCycles } from '@/data/plans'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSection } from '@/components/ui/PageSection'
import { ProgramAccentCard } from '@/components/ui/ProgramAccentCard'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import { ExerciseLibraryPanel } from '@/components/plans/ExerciseLibraryPanel'
import { CustomPlanEditor } from '@/components/plans/CustomPlanEditor'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { getTargetReps } from '@/lib/progress-engine'
import { db } from '@/lib/db'
import { pl } from '@/i18n/pl'
import { TAB_PAGE_SHELL, FOCUS_RING } from '@/lib/ui-chrome'
import { useAppStore } from '@/stores/app-store'
import type { Program } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'
import type { CustomPlan, CustomProgramProgress, ExerciseDefinition } from '@/lib/exercise-model'
import { showToast } from '@/stores/toast-store'
import {
  deleteCustomPlan,
  duplicateCustomPlan,
  hasActiveCustomWorkout,
  importCustomPlanFromJson,
  listCustomPlans,
  listExercises,
  setCustomPlanPaused,
} from '@/lib/custom-plan-service'
import { getActiveCustomWorkoutDay } from '@/lib/custom-plan-edit-lock'
import { downloadCustomPlanJson } from '@/lib/export-backup'
import { getCustomPlanResumeInfo, type CustomPlanResumeInfo } from '@/lib/custom-plan-resume'
import { CommunityCatalogPanel } from '@/components/community/CommunityCatalogPanel'
import { MyCommunityPublicationsPanel } from '@/components/community/MyCommunityPublicationsPanel'
import { PublishCommunitySheet } from '@/components/community/PublishCommunitySheet'
import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'

type PlansTab = 'mine' | 'programs' | 'library' | 'community'

function parsePlansTab(tabParam: string | null, libraryParam: string | null): PlansTab {
  if (libraryParam === '1' || tabParam === 'library') return 'library'
  if (tabParam === 'programs' || tabParam === 'builtin') return 'programs'
  if (tabParam === 'community') return 'community'
  if (tabParam === 'mine' || tabParam == null || tabParam === '') return 'mine'
  return 'mine'
}

function plansSubtitle(tab: PlansTab): string {
  if (tab === 'mine') return pl.plansMinePageHint
  if (tab === 'library') return pl.plansLibraryPageHint
  if (tab === 'community') return pl.plansCommunityPageHint
  return pl.plansCatalogHint
}

function planExerciseCount(plan: CustomPlan): number {
  return plan.days.reduce((sum, d) => sum + d.exercises.length, 0)
}

function firstDayNames(plan: CustomPlan, exercises: ExerciseDefinition[]): string {
  const day = plan.days[0]
  if (!day || day.exercises.length === 0) return ''
  return day.exercises
    .map((pe) => exercises.find((e) => e.id === pe.exerciseId)?.name ?? pl.planEllipsis)
    .join(' · ')
}

export default function PlansPage() {
  const navigate = useNavigate()
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const editParam = searchParams.get('edit')
  const dayParam = searchParams.get('day')
  const tabParam = searchParams.get('tab')
  const libraryParam = searchParams.get('library')
  const [tab, setTab] = useState<PlansTab>(() =>
    highlightId ? 'programs' : parsePlansTab(tabParam, libraryParam),
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const [progressByProgram, setProgressByProgram] = useState<
    Partial<Record<Program, LocalProgramProgress>>
  >({})
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([])
  const [customLoading, setCustomLoading] = useState(true)
  const [customLoadError, setCustomLoadError] = useState<string | null>(null)
  const [customResume, setCustomResume] = useState<Record<string, CustomPlanResumeInfo | null>>({})
  const [customProgress, setCustomProgress] = useState<
    Record<string, CustomProgramProgress | null>
  >({})
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [editorInitialDay, setEditorInitialDay] = useState<number | null>(null)
  const [editorActiveDay, setEditorActiveDay] = useState<number | null>(null)
  const [morePlan, setMorePlan] = useState<CustomPlan | null>(null)
  const [publishPlan, setPublishPlan] = useState<CustomPlan | null>(null)
  const [deletePlan, setDeletePlan] = useState<CustomPlan | null>(null)
  const online = useOnline()
  const communityMine = searchParams.get('mine') === '1'
  const importInputRef = useRef<HTMLInputElement>(null)
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const pushups = allCycles.filter((c) => c.program === 'pushups')
  const pullups = allCycles.filter((c) => c.program === 'pullups')

  function writeTabParam(next: PlansTab) {
    const params = new URLSearchParams(searchParams)
    params.delete('library')
    params.delete('highlight')
    if (next !== 'community') params.delete('mine')
    if (next === 'mine') {
      params.set('tab', 'mine')
    } else if (next === 'programs') {
      params.set('tab', 'programs')
    } else if (next === 'community') {
      params.set('tab', 'community')
    } else {
      params.set('tab', 'library')
    }
    setSearchParams(params, { replace: true })
  }

  async function reloadCustom() {
    setCustomLoading(true)
    setCustomLoadError(null)
    try {
      const plans = await listCustomPlans()
      setCustomPlans(plans)
      setExercises(await listExercises())
      const resumeMap: Record<string, CustomPlanResumeInfo | null> = {}
      const progressMap: Record<string, CustomProgramProgress | null> = {}
      for (const plan of plans.filter((p) => p.status === 'active')) {
        resumeMap[plan.id] = await getCustomPlanResumeInfo(plan.id)
        progressMap[plan.id] =
          (await db.customProgramProgress.where('customPlanId').equals(plan.id).first()) ?? null
      }
      setCustomResume(resumeMap)
      setCustomProgress(progressMap)
    } catch {
      setCustomLoadError(pl.errorLoadPlans)
    } finally {
      setCustomLoading(false)
    }
  }

  async function openEditor(planId: string | null, opts?: { dayNumber?: number }) {
    if (planId) {
      const activeDay = await getActiveCustomWorkoutDay(planId)
      setEditorActiveDay(activeDay)
      if (activeDay != null && opts?.dayNumber != null && activeDay === opts.dayNumber) {
        showToast(pl.customEditBlockedActiveDay, 'error')
        return
      }
    } else {
      setEditorActiveDay(null)
    }
    setEditorInitialDay(opts?.dayNumber ?? null)
    setEditingPlanId(planId)
    setEditorOpen(true)
  }

  async function handleImportPlanFile(file: File) {
    try {
      const plan = await importCustomPlanFromJson(await file.text())
      showToast(pl.planImportDone, 'success')
      await reloadCustom()
      await openEditor(plan.id)
    } catch (e) {
      showToast(e instanceof Error ? e.message : pl.importInvalid, 'error')
    }
  }

  async function confirmDeletePlan(plan: CustomPlan) {
    if (await hasActiveCustomWorkout(plan.id)) {
      showToast(pl.planEditBlockedActive, 'error')
      setDeletePlan(null)
      return
    }
    await deleteCustomPlan(plan.id)
    setDeletePlan(null)
    await reloadCustom()
  }

  useEffect(() => {
    void (async () => {
      const rows = await db.programProgress.toArray()
      const map: Partial<Record<Program, LocalProgramProgress>> = {}
      for (const row of rows) {
        map[row.program] = row
      }
      setProgressByProgram(map)
    })()
    void reloadCustom()
  }, [lastSyncedAt])

  useEffect(() => {
    if (highlightId) {
      setTab('programs')
      return
    }
    setTab(parsePlansTab(tabParam, libraryParam))
  }, [tabParam, libraryParam, highlightId])

  useEffect(() => {
    if (libraryParam !== '1') return
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'library')
    next.delete('library')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy library=1 once
  }, [libraryParam])

  useEffect(() => {
    if (!editParam) return
    setTab('mine')
    const dayNum = dayParam ? Number(dayParam) : undefined
    void openEditor(editParam, dayNum && Number.isFinite(dayNum) ? { dayNumber: dayNum } : undefined)
    const next = new URLSearchParams(searchParams)
    next.delete('edit')
    next.delete('day')
    if (next.get('tab') !== 'mine') next.set('tab', 'mine')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per edit param
  }, [editParam])

  useEffect(() => {
    if (!highlightId || tab !== 'programs') return
    setOpenId(highlightId)
    const t = window.setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => window.clearTimeout(t)
  }, [highlightId, progressByProgram, tab])

  const currentCycleIds = new Set(
    Object.values(progressByProgram)
      .map((p) => p?.cycleId)
      .filter(Boolean) as string[],
  )

  return (
    <div className={TAB_PAGE_SHELL}>
      <PageHeader title={pl.navPlans} subtitle={plansSubtitle(tab)} />

      <SegmentedControl
        className="mt-2"
        size="compact"
        value={tab}
        onChange={(v) => {
          setTab(v)
          writeTabParam(v)
        }}
        options={[
          { value: 'mine', label: pl.plansTabMine },
          { value: 'community', label: pl.plansTabCommunity },
          { value: 'programs', label: pl.plansTabPrograms },
          { value: 'library', label: pl.plansTabLibrary },
        ]}
      />

      {tab === 'community' &&
        (communityMine ? (
          <MyCommunityPublicationsPanel />
        ) : (
          <CommunityCatalogPanel showMyLink />
        ))}

      {tab === 'mine' && (
        <PageSection
          title={pl.myPlansTitle}
          hint={customPlans.length > 0 && !customLoading ? pl.myPlansHint : undefined}
          className="mt-4"
        >
          {customLoadError && (
            <ErrorBanner message={customLoadError} onRetry={() => void reloadCustom()} />
          )}
          <div className="mb-4 flex flex-col gap-2">
            <Button type="button" size="touch" fullWidth onClick={() => void openEditor(null)}>
              {pl.newCustomPlan}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => importInputRef.current?.click()}
            >
              {pl.planImportJson}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void handleImportPlanFile(file)
              }}
            />
          </div>
          {customLoading ? (
            <div className="flex flex-col gap-3">
              <SkeletonCard className="min-h-[6.5rem]" />
              <SkeletonCard className="min-h-[6.5rem]" />
            </div>
          ) : customPlans.length === 0 ? (
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.myPlansEmpty}
              description={pl.myPlansHint}
              action={{
                label: pl.myPlansEmptyCta,
                onClick: () => void openEditor(null),
              }}
              secondaryAction={{
                label: pl.plansTabLibrary,
                onClick: () => {
                  setTab('library')
                  writeTabParam('library')
                },
              }}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {customPlans.map((plan) => {
                const names = firstDayNames(plan, exercises)
                const totalEx = planExerciseCount(plan)
                const progress = customProgress[plan.id]
                const paused = progress?.status === 'paused'
                const canTrain = plan.status === 'active' && (!paused || customResume[plan.id])
                return (
                  <li
                    key={plan.id}
                    className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--sr-text-primary)]">
                          {plan.name.trim() || pl.planDash}
                        </p>
                        <p className="text-sm text-[var(--sr-text-muted)]">
                          {pl.planDaysCount(plan.days.length)}
                          {totalEx > 0 ? ` · ${pl.planTotalExercises(totalEx)}` : ''}
                        </p>
                        {names ? (
                          <p className="mt-1 truncate text-sm text-[var(--sr-text-secondary)]">
                            {names}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant={plan.status === 'active' ? 'success' : 'default'}>
                        {plan.status === 'active' ? pl.planStatusActive : pl.planStatusDraft}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canTrain ? (
                        <Button
                          type="button"
                          size="md"
                          onClick={() => navigate(`/workout/custom/${plan.id}`)}
                        >
                          {customResume[plan.id]
                            ? pl.continueWorkout(
                                customResume[plan.id]!.day,
                                customResume[plan.id]!.set,
                                customResume[plan.id]!.totalSets,
                              )
                            : pl.planTrain}
                        </Button>
                      ) : paused ? (
                        <Button
                          type="button"
                          size="md"
                          onClick={() =>
                            void setCustomPlanPaused(plan.id, false).then(() => reloadCustom())
                          }
                        >
                          {pl.planResume}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="md"
                        variant={plan.status === 'active' ? 'secondary' : 'primary'}
                        onClick={() => void openEditor(plan.id)}
                      >
                        {pl.editPlan}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setMorePlan(plan)}
                      >
                        {pl.planMoreActions}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </PageSection>
      )}

      {tab === 'library' && (
        <div className="mt-4">
          <ExerciseLibraryPanel mode="manage" onExercisesChange={() => void reloadCustom()} />
        </div>
      )}

      {tab === 'programs' &&
        (allCycles.length === 0 ? (
          <EmptyState icon={<LogoMark size={48} />} title={pl.noPlans} />
        ) : (
          <>
            <PageSection title={pl.pushupsProgram} hint={pl.plansProgramHint} className="mt-4">
              <CycleList
                program="pushups"
                cycles={pushups}
                openId={openId}
                setOpenId={setOpenId}
                highlightId={highlightId}
                highlightRef={highlightRef}
                currentCycleIds={currentCycleIds}
              />
            </PageSection>

            <PageSection title={pl.pullupsProgram} hint={pl.plansProgramHint} className="mt-8">
              <CycleList
                program="pullups"
                cycles={pullups}
                openId={openId}
                setOpenId={setOpenId}
                highlightId={highlightId}
                highlightRef={highlightRef}
                currentCycleIds={currentCycleIds}
              />
            </PageSection>

            <PageSection title={pl.resistanceBandsTitle} hint={pl.resistanceBandsIntro} className="mt-8">
              <ul className="list-disc space-y-2 pl-5 sr-text-body-sm text-[var(--sr-text-secondary)]">
                <li>{pl.resistanceBandsTip1}</li>
                <li>{pl.resistanceBandsTip2}</li>
                <li>{pl.resistanceBandsTip3}</li>
              </ul>
              <p className="mt-3 sr-text-body-sm text-[var(--sr-text-muted)]">
                {pl.resistanceBandsNote}
              </p>
            </PageSection>
          </>
        ))}

      <CustomPlanEditor
        open={editorOpen}
        planId={editingPlanId}
        initialDayNumber={editorInitialDay}
        activeWorkoutDayNumber={editorActiveDay}
        onClose={() => {
          setEditorOpen(false)
          setEditingPlanId(null)
          setEditorInitialDay(null)
          setEditorActiveDay(null)
        }}
        onSaved={() => void reloadCustom()}
      />

      {morePlan && (
        <Sheet
          open
          elevated
          onClose={() => setMorePlan(null)}
          title={morePlan.name.trim() || pl.planMoreActions}
        >
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() =>
                void duplicateCustomPlan(morePlan.id).then(() => {
                  setMorePlan(null)
                  return reloadCustom()
                })
              }
            >
              {pl.planDuplicate}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                downloadCustomPlanJson(morePlan)
                setMorePlan(null)
              }}
            >
              {pl.planExportJson}
            </Button>
            {morePlan.status === 'active' ? (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={!online}
                onClick={() => {
                  if (!online) {
                    showToast(pl.communityPublishOfflineHint, 'info')
                    return
                  }
                  setPublishPlan(morePlan)
                  setMorePlan(null)
                }}
              >
                {pl.communityPublish}
              </Button>
            ) : null}
            {morePlan.status === 'active' ? (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() =>
                  void setCustomPlanPaused(
                    morePlan.id,
                    customProgress[morePlan.id]?.status !== 'paused',
                  ).then(() => {
                    setMorePlan(null)
                    return reloadCustom()
                  })
                }
              >
                {customProgress[morePlan.id]?.status === 'paused' ? pl.planResume : pl.planPause}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="danger"
              fullWidth
              onClick={() => {
                setDeletePlan(morePlan)
                setMorePlan(null)
              }}
            >
              {pl.planDelete}
            </Button>
          </div>
        </Sheet>
      )}

      {deletePlan && (
        <ConfirmSheet
          title={pl.planDelete}
          message={pl.planDeleteConfirm(deletePlan.name)}
          confirmLabel={pl.planDelete}
          variant="danger"
          onConfirm={() => void confirmDeletePlan(deletePlan)}
          onCancel={() => setDeletePlan(null)}
        />
      )}

      <PublishCommunitySheet
        plan={publishPlan}
        open={publishPlan != null}
        onClose={() => setPublishPlan(null)}
      />
    </div>
  )
}

function CycleList({
  program,
  cycles,
  openId,
  setOpenId,
  highlightId,
  highlightRef,
  currentCycleIds,
}: {
  program: Program
  cycles: typeof allCycles
  openId: string | null
  setOpenId: (id: string | null) => void
  highlightId: string | null
  highlightRef: React.RefObject<HTMLDivElement | null>
  currentCycleIds: Set<string>
}) {
  return (
    <div className="flex flex-col gap-3">
      {cycles.map((cycle) => {
        const open = openId === cycle.id
        const panelId = `cycle-panel-${cycle.id}`
        const isCurrent = currentCycleIds.has(cycle.id)
        const isHighlighted = highlightId === cycle.id
        const peakDay = cycle.days.reduce(
          (best, day) => {
            const total = day.sets.reduce((s, t) => s + getTargetReps(t), 0)
            return total > best.total ? { total, day } : best
          },
          { total: 0, day: cycle.days[0] },
        )

        return (
          <div key={cycle.id} ref={isHighlighted ? highlightRef : undefined}>
            <ProgramAccentCard
              program={program}
              className={cn('p-4', isHighlighted && 'ring-2 ring-[var(--sr-brand-primary)]')}
            >
              <button
                type="button"
                className={cn(
                  'flex min-h-12 w-full items-center justify-between gap-3 text-left',
                  FOCUS_RING,
                )}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : cycle.id)}
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="block sr-text-h3 text-[var(--sr-text-primary)]">
                      {cycle.nameShort}
                    </span>
                    {isCurrent && <Badge variant="success">{pl.plansYourCycle}</Badge>}
                  </span>
                  <span className="mt-0.5 block sr-text-body-sm text-[var(--sr-text-secondary)]">
                    {pl.plansDayCount(cycle.days.length)}
                    {peakDay.total > 0 && (
                      <>
                        {' · '}
                        {pl.plansPeakDay(peakDay.day.dayNumber, peakDay.total)}
                      </>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-[var(--sr-text-muted)]">
                  {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </span>
              </button>
              {open && (
                <div
                  id={panelId}
                  className="mt-4 space-y-4 border-t border-[var(--sr-border-subtle)] pt-4"
                >
                  {cycle.days.map((day) => {
                    const dayTotal = day.sets.reduce((s, t) => s + getTargetReps(t), 0)
                    return (
                      <div key={day.dayNumber}>
                        <div className="mb-2 flex items-baseline justify-between gap-2">
                          <p className="font-semibold text-[var(--sr-text-primary)]">
                            {pl.dayLabel(day.dayNumber)}
                          </p>
                          <p className="sr-text-body-sm tabular-nums text-[var(--sr-text-secondary)]">
                            {pl.plansDayReps(day.sets.length, dayTotal)}
                          </p>
                        </div>
                        <SetTargetsRow sets={day.sets} size="md" />
                        <p className="mt-2 sr-text-body-sm text-[var(--sr-text-muted)]">
                          {pl.restBetweenSets(day.restBetweenSetsSec)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </ProgramAccentCard>
          </div>
        )
      })}
    </div>
  )
}
