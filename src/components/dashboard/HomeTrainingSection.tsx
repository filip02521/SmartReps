import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Dumbbell, LayoutGrid, Plus } from 'lucide-react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ProgramHomeCard } from '@/components/dashboard/ProgramHomeCard'
import { CustomPlanHomeCard } from '@/components/dashboard/CustomPlanHomeCard'
import { CustomPlanMapSheet } from '@/components/dashboard/CustomPlanMapSheet'
import { FreeWorkoutHeroCard } from '@/components/dashboard/FreeWorkoutHeroCard'
import { RestHeroCard } from '@/components/dashboard/RestHeroCard'
import { TrainingOptionRow } from '@/components/dashboard/TrainingOptionRow'
import { BuiltinWorkoutPreviewSheet } from '@/components/workout/WorkoutPreviewSheet'
import { CycleMapSheet } from '@/components/dashboard/program-card/ProgramCardSheets'
import {
  AccentIconBadge,
  ProgramIconBadge,
} from '@/components/dashboard/program-card/ProgramIconBadge'
import { SessionElapsedLabel } from '@/components/workout/SessionElapsedLabel'
import { StreakFlame } from '@/components/dashboard/StreakFlame'
import { pl } from '@/i18n/pl'
import { getCycleById } from '@/data/plans'
import { getMaxSetPerDay } from '@/lib/stats-engine'
import { getStatusLabel } from '@/lib/program-service'
import { beginProgramSetup } from '@/lib/setup-flow'
import { useAppStore } from '@/stores/app-store'
import type {
  HomeLoadResult,
  ProgramCardModel,
  TipSuppression,
} from '@/lib/home-summary'
import type { CustomPlanHomeCardModel } from '@/lib/custom-plan-home-summary'

function neutralBadge(icon: ReactNode) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]"
      aria-hidden
    >
      {icon}
    </div>
  )
}

function builtinCaption(card: ProgramCardModel): string {
  if (card.loadError) return card.loadError
  if (card.resume) {
    return pl.homeStatusResumeSubtitle(card.resume.set, card.resume.total)
  }
  if (card.bucket === 'unconfigured' || !card.progress) return pl.notConfigured
  if (card.bucket === 'ready') {
    return pl.dayOfTotal(card.progress.currentDay, card.cycleDayCount)
  }
  if (card.bucket === 'resting' || card.bucket === 'test_pending_rest') {
    return card.stats?.nextWorkoutLabel ?? getStatusLabel(card.progress)
  }
  return getStatusLabel(card.progress)
}

function customCaption(model: CustomPlanHomeCardModel): string {
  if (model.resume) {
    return pl.homeCustomResumeHint(model.resume.set, model.resume.totalSets)
  }
  if (model.isPaused || model.isResting || model.isCycleComplete) {
    return `${model.dayLine} · ${model.badge.label}`
  }
  return model.dayLine
}

/** Training zone — one hero card (the resolved next action) plus uniform
 *  compact rows for every other way to train or manage plans. */
export function HomeTrainingSection({
  home,
  tipSuppression,
  onReload,
  streak = 0,
  streakAtRisk = false,
}: {
  home: HomeLoadResult
  tipSuppression: TipSuppression
  onReload: () => void
  streak?: number
  streakAtRisk?: boolean
}) {
  const navigate = useNavigate()
  const enabledPrograms = useAppStore((s) => s.settings.enabledPrograms)
  const enabledCustomPlanIds = useAppStore((s) => s.settings.enabledCustomPlanIds)
  const filterExplicit = useAppStore((s) => s.settings.customPlansFilterExplicit)
  const { next, customCards, extraPlanCount, activePlanCount, freeSession } =
    home.training

  const heroCard = next.kind === 'builtin' ? next.card : null
  const heroModel = next.kind === 'custom' ? next.model : null

  const [previewCard, setPreviewCard] = useState<ProgramCardModel | null>(null)
  const [cycleMapCard, setCycleMapCard] = useState<ProgramCardModel | null>(null)
  const [cycleMapDay, setCycleMapDay] = useState<number | null>(null)
  const [maxPerDay, setMaxPerDay] = useState<{ day: number; maxActual: number }[]>([])
  const [planMap, setPlanMap] = useState<{ planId: string; title: string } | null>(null)

  async function openCycleMap(card: ProgramCardModel) {
    if (!card.progress) return
    setMaxPerDay(
      await getMaxSetPerDay(
        card.program,
        card.progress.cycleId,
        card.progress.cycleAttempt,
      ),
    )
    setCycleMapDay(card.progress.currentDay)
    setCycleMapCard(card)
  }

  function builtinRowTap(card: ProgramCardModel) {
    if (card.resume) {
      navigate(`/workout/${card.program}?force=1`)
      return
    }
    if (card.loadError) {
      onReload()
      return
    }
    if (!card.progress || card.bucket === 'unconfigured') {
      navigate(`/setup/test/${card.program}`)
      return
    }
    if (card.bucket === 'test_pending_ready') {
      void beginProgramSetup(navigate, card.program, { retest: true })
      return
    }
    if (card.bucket === 'ready') {
      setPreviewCard(card)
      return
    }
    void openCycleMap(card)
  }

  function customRowTap(model: CustomPlanHomeCardModel) {
    if (model.resume) {
      navigate(`/workout/custom/${model.planId}`)
      return
    }
    setPlanMap({ planId: model.planId, title: model.planName })
  }

  const rows: ReactNode[] = []

  if (next.kind !== 'free') {
    rows.push(
      <li key="free">
        <TrainingOptionRow
          icon={
            <AccentIconBadge accent="var(--sr-brand-primary)">
              <Dumbbell size={20} strokeWidth={2.25} />
            </AccentIconBadge>
          }
          title={pl.freeWorkoutTitle}
          caption={
            freeSession ? (
              <SessionElapsedLabel startedAt={freeSession.startedAt} />
            ) : (
              pl.freeWorkoutHomeHint
            )
          }
          onClick={() => navigate('/workout/free')}
          ariaLabel={freeSession ? pl.freeWorkoutResume : pl.freeWorkoutStart}
        />
      </li>,
    )
  }

  for (const model of customCards) {
    if (heroModel?.planId === model.planId) continue
    rows.push(
      <li key={`custom-${model.planId}`}>
        <TrainingOptionRow
          icon={
            <AccentIconBadge accent="var(--sr-brand-primary)">
              <Dumbbell size={20} strokeWidth={2.25} />
            </AccentIconBadge>
          }
          title={model.planName}
          caption={customCaption(model)}
          onClick={() => customRowTap(model)}
        />
      </li>,
    )
  }

  for (const card of home.cards) {
    if (heroCard?.program === card.program) continue
    rows.push(
      <li key={`builtin-${card.program}`}>
        <TrainingOptionRow
          id={`program-${card.program}`}
          icon={<ProgramIconBadge program={card.program} />}
          title={card.label}
          caption={builtinCaption(card)}
          onClick={() => builtinRowTap(card)}
        />
      </li>,
    )
  }

  const allPlansHidden =
    filterExplicit && enabledCustomPlanIds.length === 0 && activePlanCount > 0
  if (extraPlanCount > 0 || allPlansHidden) {
    rows.push(
      <li key="plans-more">
        <TrainingOptionRow
          icon={neutralBadge(<LayoutGrid size={20} strokeWidth={2} />)}
          title={
            allPlansHidden
              ? pl.customHomeEmptyTitle
              : pl.customHomeMorePlans(extraPlanCount)
          }
          caption={allPlansHidden ? pl.customHomeEmptyHint : undefined}
          onClick={() => navigate('/plans?tab=mine')}
        />
      </li>,
    )
  }

  rows.push(
    <li key="new-plan">
      <TrainingOptionRow
        icon={neutralBadge(<Plus size={20} strokeWidth={2.25} />)}
        title={pl.homeRowNewPlan}
        caption={pl.homeRowNewPlanHint}
        onClick={() => navigate('/plans?tab=mine')}
      />
    </li>,
  )

  if (enabledPrograms.length < 3) {
    rows.push(
      <li key="programs">
        <TrainingOptionRow
          icon={neutralBadge(<Dumbbell size={20} strokeWidth={2} />)}
          title={pl.programs}
          caption={pl.homeRowProgramsHint}
          onClick={() => navigate('/plans?tab=programs')}
        />
      </li>,
    )
  }

  rows.push(
    <li key="library">
      <TrainingOptionRow
        icon={neutralBadge(<BookOpen size={20} strokeWidth={2} />)}
        title={pl.homeCustomEmptyLibrary}
        caption={pl.homeRowLibraryHint}
        onClick={() => navigate('/plans?tab=library')}
      />
    </li>,
  )

  return (
    <section aria-label={pl.homeStartTraining} className="mt-6">
      <SectionHeader icon={Dumbbell} title={pl.homeStartTraining} />

      {/* Streak-saving ribbon — loss aversion pinned to the action that
          cancels it: whatever the hero resolves to, finishing it keeps the
          streak alive. */}
      {streakAtRisk && (
        <div className="mb-2 flex items-center gap-2 rounded-[var(--sr-radius-md)] border border-[color-mix(in_srgb,var(--sr-warning)_35%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-warning)_8%,var(--sr-bg-surface))] px-3 py-2">
          <StreakFlame streak={streak} size={14} dying />
          <p className="sr-text-caption font-semibold text-[var(--sr-warning)]">
            {pl.streakHeroSaveRibbon(streak)}
          </p>
        </div>
      )}

      {next.kind === 'builtin' && (
        <ProgramHomeCard
          model={next.card}
          allResting={home.summary.allResting}
          tipSuppression={tipSuppression}
          onReload={onReload}
        />
      )}
      {next.kind === 'custom' && (
        <CustomPlanHomeCard model={next.model} onUpdated={onReload} />
      )}
      {next.kind === 'rest' && <RestHeroCard card={next.card} />}
      {next.kind === 'free' && <FreeWorkoutHeroCard session={freeSession} />}

      <SectionHeader
        as="h3"
        density="compact"
        title={pl.homeMoreTraining}
        className="mt-5"
      />
      <ul className="flex flex-col gap-2">{rows}</ul>

      {previewCard && previewCard.progress && previewCard.currentDaySets && (
        <BuiltinWorkoutPreviewSheet
          open
          onClose={() => setPreviewCard(null)}
          programLabel={previewCard.label}
          dayNumber={previewCard.progress.currentDay}
          cycleName={previewCard.cycleNameShort}
          sets={previewCard.currentDaySets}
          restBetweenSetsSec={
            getCycleById(previewCard.progress.cycleId)?.days.find(
              (d) => d.dayNumber === previewCard.progress!.currentDay,
            )?.restBetweenSetsSec ?? 90
          }
          onStart={() => {
            setPreviewCard(null)
            navigate(
              `/workout/${previewCard.program}${
                previewCard.available ? '' : '?force=1'
              }`,
            )
          }}
        />
      )}

      {cycleMapCard?.progress &&
        (() => {
          const progress = cycleMapCard.progress!
          const cycle = getCycleById(progress.cycleId)
          if (!cycle) return null
          return (
            <CycleMapSheet
              cycle={cycle}
              progress={progress}
              stats={cycleMapCard.stats}
              maxPerDay={maxPerDay}
              selectedDay={cycleMapDay}
              onSelectDay={setCycleMapDay}
              onShowFullPlan={() => {
                setCycleMapCard(null)
                setCycleMapDay(null)
                navigate(`/plans?tab=programs&highlight=${progress.cycleId}`)
              }}
              onClose={() => {
                setCycleMapCard(null)
                setCycleMapDay(null)
              }}
            />
          )
        })()}

      {planMap && (
        <CustomPlanMapSheet
          planId={planMap.planId}
          fallbackTitle={planMap.title}
          onClose={() => setPlanMap(null)}
        />
      )}
    </section>
  )
}
