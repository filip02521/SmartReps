import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { ChevronRight, Copy, Dumbbell, Download, MoreHorizontal, Pause, Pencil, Play, Plus, Share2, Trash2, Upload } from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { allCycles } from '@/data/plans'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSection } from '@/components/ui/PageSection'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import { ExerciseLibraryPanel } from '@/components/plans/ExerciseLibraryPanel'
import { CustomPlanEditor } from '@/components/plans/CustomPlanEditor'
import { AiPlanGenerator } from '@/components/plans/AiPlanGenerator'
import { StarterTemplateSheet } from '@/components/plans/StarterTemplateSheet'
import { StarterTemplateChip, StarterTemplateCard } from '@/components/plans/StarterTemplateCard'
import { STARTER_TEMPLATES, type StarterTemplate } from '@/data/starter-templates'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { CustomWorkoutPreviewSheet } from '@/components/workout/WorkoutPreviewSheet'
import { ProgramSettingsCard } from '@/components/profile/ProgramSettingsCard'
import { ProgramBrowser } from '@/components/plans/ProgramBrowser'
import { getLastTestReps } from '@/lib/cycle-selector'
import { db } from '@/lib/db'
import { pl } from '@/i18n/pl'
import { TAB_PAGE_SHELL, FOCUS_RING } from '@/lib/ui-chrome'
import { useAppStore } from '@/stores/app-store'
import { getProgramProgress, reconcileActiveWorkout, setProgramPaused } from '@/lib/program-service'
import { beginLevelChange, beginProgramSetup } from '@/lib/setup-flow'
import type { Program } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'
import type { CustomPlan, CustomProgramProgress, ExerciseDefinition } from '@/lib/exercise-model'
import { showToast } from '@/stores/toast-store'
import {
  deleteCustomPlan,
  duplicateCustomPlan,
  getOrCreateCustomProgress,
  hasActiveCustomWorkout,
  importCustomPlanFromJson,
  listCustomPlans,
  listExercises,
  repairPlanSetMetrics,
  setCustomPlanPaused,
} from '@/lib/custom-plan-service'
import { getActiveCustomWorkoutDay } from '@/lib/custom-plan-edit-lock'
import { getCustomPlanDisplayDay } from '@/lib/custom-plan-home-summary'
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
  return pl.plansProgramsPageHint
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
  const { settings, setSettings } = useAppStore()
  const [searchParams, setSearchParams] = useSearchParams()
  useSeo({ title: pl.seoPlansTitle, description: pl.seoPlansDescription, path: '/plans' })
  const highlightId = searchParams.get('highlight')
  const editParam = searchParams.get('edit')
  const dayParam = searchParams.get('day')
  const tabParam = searchParams.get('tab')
  const libraryParam = searchParams.get('library')
  const [tab, setTab] = useState<PlansTab>(() =>
    highlightId ? 'programs' : parsePlansTab(tabParam, libraryParam),
  )
  const [progressByProgram, setProgressByProgram] = useState<
    Partial<Record<Program, LocalProgramProgress>>
  >({})
  const [lastTestRepsByProgram, setLastTestRepsByProgram] = useState<
    Partial<Record<Program, number | null>>
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
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false)
  const [starterSheetOpen, setStarterSheetOpen] = useState(false)
  const [starterInitialPreview, setStarterInitialPreview] = useState<StarterTemplate | null>(null)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [editorInitialDay, setEditorInitialDay] = useState<number | null>(null)
  const [editorActiveDay, setEditorActiveDay] = useState<number | null>(null)
  const [morePlan, setMorePlan] = useState<CustomPlan | null>(null)
  const [publishPlan, setPublishPlan] = useState<CustomPlan | null>(null)
  const [previewPlan, setPreviewPlan] = useState<{
    plan: CustomPlan
    day: CustomPlan['days'][0]
    dayNumber: number
  } | null>(null)
  const [deletePlan, setDeletePlan] = useState<CustomPlan | null>(null)
  const [pendingChangeLevel, setPendingChangeLevel] = useState<Program | null>(null)
  const [pendingRetest, setPendingRetest] = useState<Program | null>(null)
  const [pendingDisable, setPendingDisable] = useState<Program | null>(null)
  const [programsReady, setProgramsReady] = useState(false)
  const online = useOnline()
  const communityMine = searchParams.get('mine') === '1'
  const importInputRef = useRef<HTMLInputElement>(null)
  const pushups = useMemo(() => allCycles.filter((c) => c.program === 'pushups'), [])
  const pullups = useMemo(() => allCycles.filter((c) => c.program === 'pullups'), [])
  const squats = useMemo(() => allCycles.filter((c) => c.program === 'squats'), [])

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
      // Auto-repair: fix set targets that don't match exercise primaryMetric
      // (one-time fix for AI-generated plans with mismatched metrics)
      try {
        const repaired = await repairPlanSetMetrics()
        if (repaired.fixedPlans > 0) {
          showToast(
            pl.plansRepairedToast(repaired.fixedPlans, repaired.fixedSets),
            'success',
          )
        }
      } catch {
        // Silent — repair is best-effort
      }

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
    } catch {
      showToast(pl.importInvalid, 'error')
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

  async function reloadPrograms() {
    const map: Partial<Record<Program, LocalProgramProgress>> = {}
    const testMap: Partial<Record<Program, number | null>> = {}
    // Ładuj postęp i ostatni test dla wszystkich programów (również niewłączonych),
    // aby browser mógł pokazać badge „Zalecany" i obsłużyć aktywację.
    for (const p of ['pushups', 'pullups', 'squats'] as Program[]) {
      const prog = await getProgramProgress(p)
      if (prog) map[p] = prog
      testMap[p] = await getLastTestReps(p)
    }
    setProgressByProgram(map)
    setLastTestRepsByProgram(testMap)
    setProgramsReady(true)
  }

  const retest = async (program: Program) => {
    const active = await reconcileActiveWorkout(program)
    if (active) {
      setPendingRetest(program)
      return
    }
    await beginProgramSetup(navigate, program, { retest: true })
  }

  const confirmRetest = async () => {
    if (!pendingRetest) return
    const program = pendingRetest
    setPendingRetest(null)
    await beginProgramSetup(navigate, program, { retest: true })
  }

  const changeLevel = async (program: Program) => {
    const active = await reconcileActiveWorkout(program)
    if (active) {
      setPendingChangeLevel(program)
      return
    }
    await beginLevelChange(navigate, program)
  }

  const confirmChangeLevel = async () => {
    if (!pendingChangeLevel) return
    const program = pendingChangeLevel
    setPendingChangeLevel(null)
    await beginLevelChange(navigate, program)
  }

  const addProgram = (program: Program) => {
    if (settings.enabledPrograms.includes(program)) return
    setSettings({ enabledPrograms: [...settings.enabledPrograms, program] })
  }

  // Czyści parametr ?highlight=... z URL po otwarciu sheet cyklu (deep-link z Dashboardu)
  const clearHighlightParam = useCallback(() => {
    setSearchParams((prev) => {
      if (!prev.has('highlight')) return prev
      const next = new URLSearchParams(prev)
      next.delete('highlight')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const disableProgram = (program: Program) => {
    const next = settings.enabledPrograms.filter((p) => p !== program)
    setSettings({ enabledPrograms: next })
    setPendingDisable(null)
  }

  const togglePause = async (program: Program) => {
    const prog = progressByProgram[program]
    if (!prog) return
    await setProgramPaused(program, prog.status !== 'paused')
    await reloadPrograms()
  }

  const missingPrograms = (['pushups', 'pullups', 'squats'] as Program[]).filter(
    (p) => !settings.enabledPrograms.includes(p),
  )

  const showProgramsLoading =
    !programsReady &&
    Object.keys(progressByProgram).length === 0 &&
    settings.enabledPrograms.length > 0

  const toggleCustomPlanTraining = (plan: CustomPlan, checked: boolean) => {
    const current = settings.customPlansFilterExplicit
      ? [...settings.enabledCustomPlanIds]
      : customPlans.filter((p) => p.status === 'active').map((p) => p.id)
    const next = checked
      ? Array.from(new Set([...current, plan.id]))
      : current.filter((id) => id !== plan.id)
    setSettings({
      customPlansFilterExplicit: true,
      enabledCustomPlanIds: next,
    })
  }

  const isCustomPlanOnTraining = (plan: CustomPlan) =>
    !settings.customPlansFilterExplicit || settings.enabledCustomPlanIds.includes(plan.id)

  useEffect(() => {
    void (async () => {
      const rows = await db.programProgress.toArray()
      const map: Partial<Record<Program, LocalProgramProgress>> = {}
      for (const row of rows) {
        map[row.program] = row
      }
      setProgressByProgram(map)
      // Załaduj ostatnie testy dla wszystkich programów (browser badge „Zalecany")
      const testMap: Partial<Record<Program, number | null>> = {}
      for (const p of ['pushups', 'pullups', 'squats'] as Program[]) {
        testMap[p] = await getLastTestReps(p)
      }
      setLastTestRepsByProgram(testMap)
      setProgramsReady(true)
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

  return (
    <div className={TAB_PAGE_SHELL}>
      <PageHeader title={pl.navPlans} subtitle={plansSubtitle(tab)} />

      <SegmentedControl
        className="mb-6"
        size="compact"
        stretch
        aria-label={pl.plansTabAriaLabel}
        value={tab}
        onChange={(v) => {
          setTab(v)
          writeTabParam(v)
        }}
        options={[
          { value: 'mine', label: pl.plansTabMine },
          { value: 'programs', label: pl.plansTabPrograms },
          { value: 'community', label: pl.plansTabCommunity },
          { value: 'library', label: pl.plansTabLibrary },
        ]}
      />

      {tab === 'community' && (
        <div>
          {communityMine ? (
            <MyCommunityPublicationsPanel />
          ) : (
            <CommunityCatalogPanel showMyLink />
          )}
        </div>
      )}

      {tab === 'mine' && (
        <>
        <PageSection
          title={pl.myPlansTitle}
          hint={customPlans.length > 0 && !customLoading ? pl.myPlansHint : undefined}
        >
          {customLoadError && (
            <ErrorBanner message={customLoadError} onRetry={() => void reloadCustom()} />
          )}
          <div className="mb-4 flex flex-col gap-2">
            <Button type="button" size="touch" fullWidth onClick={() => void openEditor(null)}>
              <Plus size={20} aria-hidden />
              {pl.newCustomPlan}
            </Button>
            <button
              type="button"
              onClick={() => setAiGeneratorOpen(true)}
              aria-label={pl.aiCoachName}
              className={cn(
                FOCUS_RING,
                'flex min-h-12 w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-brand-primary)]/30 bg-[var(--sr-bg-elevated)] p-4 text-left shadow-[var(--sr-shadow-card)] transition-colors hover:bg-[var(--sr-bg-surface)]',
              )}
              style={{
                backgroundImage: `linear-gradient(135deg, color-mix(in srgb, var(--sr-brand-primary) 8%, var(--sr-bg-elevated)) 0%, var(--sr-bg-elevated) 60%)`,
              }}
            >
              <AiCoachMark size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--sr-text-primary)]">
                  {pl.aiCoachName}
                </p>
                <p className="truncate text-xs text-[var(--sr-text-secondary)]">
                  {pl.aiGeneratePlanHint}
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => importInputRef.current?.click()}
            >
              <Download size={16} aria-hidden />
              {pl.planImportJson}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              aria-label={pl.planImportJson}
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
            <div className="flex flex-col gap-4">
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
              <div className="flex flex-col gap-3">
                <div>
                  <p className="sr-text-h3 text-[var(--sr-text-primary)]">
                    {pl.starterEmptyHint}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--sr-text-secondary)]">
                    {pl.starterEmptyHintDesc}
                  </p>
                </div>
                {STARTER_TEMPLATES.slice(0, 3).map((t) => (
                  <StarterTemplateCard
                    key={t.id}
                    template={t}
                    compact
                    onPreview={() => {
                      setStarterInitialPreview(t)
                      setStarterSheetOpen(true)
                    }}
                    onActivate={() => {
                      setStarterInitialPreview(null)
                      setStarterSheetOpen(true)
                    }}
                  />
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  fullWidth
                  onClick={() => setStarterSheetOpen(true)}
                >
                  {pl.starterSeeAll}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <StarterTemplateChip
                onClick={() => {
                  setStarterInitialPreview(null)
                  setStarterSheetOpen(true)
                }}
              />
              <ul className="flex flex-col gap-3">
              {customPlans.map((plan) => {
                const names = firstDayNames(plan, exercises)
                const totalEx = planExerciseCount(plan)
                const progress = customProgress[plan.id]
                const paused = progress?.status === 'paused'
                const canTrain = plan.status === 'active' && (!paused || customResume[plan.id])
                const isActive = plan.status === 'active'
                return (
                  <li
                    key={plan.id}
                    className={cn(
                      'relative overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)]',
                      'bg-[var(--sr-bg-elevated)] p-4 transition-colors hover:border-[var(--sr-border-strong)]',
                    )}
                    style={
                      isActive
                        ? {
                            backgroundImage:
                              'linear-gradient(135deg, var(--sr-brand-primary-muted) 0%, var(--sr-bg-elevated) 50%)',
                          }
                        : undefined
                    }
                  >
                    {isActive && (
                      <div
                        className="absolute inset-y-0 left-0 w-1 bg-[var(--sr-brand-primary)]"
                        aria-hidden
                      />
                    )}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <div
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]"
                          style={{
                            background: isActive
                              ? 'var(--sr-brand-primary-muted)'
                              : 'var(--sr-bg-surface)',
                            color: isActive
                              ? 'var(--sr-brand-primary)'
                              : 'var(--sr-text-muted)',
                          }}
                          aria-hidden
                        >
                          <Dumbbell size={18} strokeWidth={2.25} />
                        </div>
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
                      </div>
                      <div className="flex items-center gap-1.5">
                        {plan.source === 'starter' && (
                          <Badge variant="default">{pl.starterBadge}</Badge>
                        )}
                        <Badge variant={paused ? 'warning' : isActive ? 'success' : 'default'}>
                          {paused ? pl.planStatusPaused : isActive ? pl.planStatusActive : pl.planStatusDraft}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {canTrain ? (
                        <Button
                          type="button"
                          size="md"
                          className="max-w-full"
                          onClick={() => {
                            // Resume → go directly (workout already in progress).
                            if (customResume[plan.id]) {
                              navigate(`/workout/custom/${plan.id}`)
                              return
                            }
                            // Fresh start → preview first.
                            const prog = customProgress[plan.id]
                            const dayNumber = getCustomPlanDisplayDay(plan, prog ?? null)
                            const day = plan.days.find((d) => d.dayNumber === dayNumber) ?? plan.days[0]
                            if (!day) return
                            void getOrCreateCustomProgress(plan.id)
                            setPreviewPlan({ plan, day, dayNumber })
                          }}
                        >
                          <Play size={16} aria-hidden />
                          <span className="truncate">
                            {customResume[plan.id]
                              ? pl.continueWorkout(
                                  customResume[plan.id]!.day,
                                  customResume[plan.id]!.set,
                                  customResume[plan.id]!.totalSets,
                                )
                              : pl.planTrain}
                          </span>
                        </Button>
                      ) : paused ? (
                        <Button
                          type="button"
                          size="md"
                          onClick={() =>
                            void setCustomPlanPaused(plan.id, false).then(() => reloadCustom())
                          }
                        >
                          <Play size={16} aria-hidden />
                          {pl.planResume}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="md"
                        variant={isActive ? 'secondary' : 'primary'}
                        onClick={() => void openEditor(plan.id)}
                      >
                        <Pencil size={16} aria-hidden />
                        {pl.editPlan}
                      </Button>
                      <Button
                        type="button"
                        size="md"
                        variant="ghost"
                        className="ml-auto"
                        aria-label={pl.planMoreActions}
                        onClick={() => setMorePlan(plan)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
            </div>
          )}
        </PageSection>

        {/* Skrócony dostęp do biblioteki ćwiczeń */}
        {exercises.length > 0 && (
          <PageSection
            title={pl.myExercisesSectionTitle}
            hint={pl.myExercisesSectionHint}
            className="mt-6"
          >
            <button
              type="button"
              onClick={() => {
                setTab('library')
                writeTabParam('library')
              }}
              className="flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4 text-left shadow-[var(--sr-shadow-card)] transition-colors hover:border-[var(--sr-border-strong)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]" aria-hidden>
                <Dumbbell size={20} strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--sr-text-primary)]">
                  {pl.myExercisesSectionCta}
                </p>
                <p className="mt-0.5 text-sm text-[var(--sr-text-muted)]">
                  {pl.myExercisesCount(exercises.length)}
                </p>
              </div>
              <ChevronRight size={20} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
            </button>
          </PageSection>
        )}
        </>
      )}

      {tab === 'library' && (
        <PageSection
          title={pl.plansTabLibrary}
        >
          <ExerciseLibraryPanel mode="manage" onExercisesChange={() => void reloadCustom()} />
        </PageSection>
      )}

      {tab === 'programs' &&
        (allCycles.length === 0 ? (
          <EmptyState icon={<LogoMark size={48} />} title={pl.noPlans} />
        ) : (
          <>
            <PageSection title={pl.programs} hint={pl.plansProgramHint}>
              {showProgramsLoading ? (
                <div className="flex flex-col gap-4" aria-busy aria-label={pl.profileProgramsLoading}>
                  <SkeletonCard className="min-h-[7rem]" />
                  {settings.enabledPrograms.length > 1 && <SkeletonCard className="min-h-[7rem]" />}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {settings.enabledPrograms.length === 0 && (
                    <p className="text-pretty sr-text-body-sm text-[var(--sr-text-secondary)]">
                      {pl.profileProgramsEmpty}
                    </p>
                  )}

                  {settings.enabledPrograms.map((program) => (
                    <ProgramSettingsCard
                      key={program}
                      program={program}
                      progress={progressByProgram[program]}
                      canDisable={true}
                      onSetupOnTraining={() => navigate(`/?program=${program}`)}
                      onChangeLevel={() => void changeLevel(program)}
                      onRetest={() => void retest(program)}
                      onTogglePause={() => void togglePause(program)}
                      onDisable={() => setPendingDisable(program)}
                    />
                  ))}

                  {missingPrograms.length > 0 && (
                    <div className="rounded-[var(--sr-radius-md)] border border-dashed border-[var(--sr-border-strong)] bg-[var(--sr-bg-surface)]/60 px-3 py-3.5">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
                        {pl.addProgram}
                      </p>
                      <div className="flex flex-col gap-2">
                        {missingPrograms.map((p) => (
                          <Button
                            key={p}
                            variant="secondary"
                            size="md"
                            fullWidth
                            className="justify-start px-4"
                            onClick={() => addProgram(p)}
                          >
                            {p === 'pushups'
                              ? pl.addProgramPushups
                              : p === 'pullups'
                                ? pl.addProgramPullups
                                : pl.addProgramSquats}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </PageSection>

            <PageSection title={pl.programBrowseTitle} hint={pl.programBrowseHint} className="mt-6">
              <div className="flex flex-col gap-6">
                <ProgramBrowser
                  program="pushups"
                  cycles={pushups}
                  programEnabled={settings.enabledPrograms.includes('pushups')}
                  hasProgress={!!progressByProgram.pushups}
                  currentCycleId={progressByProgram.pushups?.cycleId ?? null}
                  currentStatus={progressByProgram.pushups?.status}
                  lastTestReps={lastTestRepsByProgram.pushups ?? null}
                  highlightCycleId={
                    highlightId && pushups.some((c) => c.id === highlightId)
                      ? highlightId
                      : null
                  }
                  onHighlightConsumed={clearHighlightParam}
                  onEnableProgram={addProgram}
                />
                <ProgramBrowser
                  program="pullups"
                  cycles={pullups}
                  programEnabled={settings.enabledPrograms.includes('pullups')}
                  hasProgress={!!progressByProgram.pullups}
                  currentCycleId={progressByProgram.pullups?.cycleId ?? null}
                  currentStatus={progressByProgram.pullups?.status}
                  lastTestReps={lastTestRepsByProgram.pullups ?? null}
                  highlightCycleId={
                    highlightId && pullups.some((c) => c.id === highlightId)
                      ? highlightId
                      : null
                  }
                  onHighlightConsumed={clearHighlightParam}
                  onEnableProgram={addProgram}
                />
                <ProgramBrowser
                  program="squats"
                  cycles={squats}
                  programEnabled={settings.enabledPrograms.includes('squats')}
                  hasProgress={!!progressByProgram.squats}
                  currentCycleId={progressByProgram.squats?.cycleId ?? null}
                  currentStatus={progressByProgram.squats?.status}
                  lastTestReps={lastTestRepsByProgram.squats ?? null}
                  highlightCycleId={
                    highlightId && squats.some((c) => c.id === highlightId)
                      ? highlightId
                      : null
                  }
                  onHighlightConsumed={clearHighlightParam}
                  onEnableProgram={addProgram}
                />
              </div>
            </PageSection>

            <PageSection title={pl.resistanceBandsTitle} hint={pl.resistanceBandsIntro} className="mt-6">
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

      <AiPlanGenerator
        open={aiGeneratorOpen}
        onClose={() => setAiGeneratorOpen(false)}
        onGenerated={() => void reloadCustom()}
      />

      <StarterTemplateSheet
        open={starterSheetOpen}
        onClose={() => {
          setStarterSheetOpen(false)
          setStarterInitialPreview(null)
        }}
        onActivated={() => void reloadCustom()}
        initialPreview={starterInitialPreview}
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
              <Copy size={16} aria-hidden />
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
              <Upload size={16} aria-hidden />
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
                <Share2 size={16} aria-hidden />
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
                {customProgress[morePlan.id]?.status === 'paused' ? (
                  <>
                    <Play size={16} aria-hidden />
                    {pl.planResume}
                  </>
                ) : (
                  <>
                    <Pause size={16} aria-hidden />
                    {pl.planPause}
                  </>
                )}
              </Button>
            ) : null}
            {morePlan.status === 'active' ? (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => {
                  toggleCustomPlanTraining(morePlan, !isCustomPlanOnTraining(morePlan))
                  setMorePlan(null)
                }}
              >
                {isCustomPlanOnTraining(morePlan) ? pl.planHideFromTraining : pl.planShowOnTraining}
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
              <Trash2 size={16} aria-hidden />
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

      {pendingChangeLevel && (
        <ConfirmSheet
          title={pl.menuChangeLevel}
          message={pl.changeLevelActiveWarning}
          confirmLabel={pl.confirm}
          variant="danger"
          onConfirm={() => void confirmChangeLevel()}
          onCancel={() => setPendingChangeLevel(null)}
        />
      )}
      {pendingRetest && (
        <ConfirmSheet
          title={pl.menuRetest}
          message={pl.changeLevelActiveWarning}
          confirmLabel={pl.confirm}
          variant="danger"
          onConfirm={() => void confirmRetest()}
          onCancel={() => setPendingRetest(null)}
        />
      )}
      {pendingDisable && (
        <ConfirmSheet
          title={pl.disableProgram}
          message={
            settings.enabledPrograms.length === 1
              ? pl.disableProgramConfirmLast
              : pl.disableProgramConfirm
          }
          confirmLabel={pl.confirm}
          variant="danger"
          onConfirm={() => disableProgram(pendingDisable)}
          onCancel={() => setPendingDisable(null)}
        />
      )}

      <PublishCommunitySheet
        plan={publishPlan}
        open={publishPlan != null}
        onClose={() => setPublishPlan(null)}
      />

      {previewPlan && (
        <CustomWorkoutPreviewSheet
          open
          onClose={() => setPreviewPlan(null)}
          planId={previewPlan.plan.id}
          planName={previewPlan.plan.name.trim() || pl.planDash}
          dayNumber={previewPlan.dayNumber}
          originalDay={previewPlan.day}
          exercises={new Map(exercises.map((e) => [e.id, e]))}
          onStart={() => {
            setPreviewPlan(null)
            navigate(`/workout/custom/${previewPlan.plan.id}`)
          }}
        />
      )}
    </div>
  )
}

