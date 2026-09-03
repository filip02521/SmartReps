import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'

export type ProgressSection = 'programs' | 'custom' | 'achievements'
export type TrainingTab = 'overview' | 'history' | 'cycle'
/** Custom progress sub-views — plan map lives inside overview (exercises). */
export type CustomProgressView = 'exercises' | 'history'

export function ProgressChromeNav({
  section,
  onSectionChange,
  hasCustom,
  trainingTab,
  onTrainingTabChange,
  program,
  programOptions,
  onProgramChange,
  customView,
  onCustomViewChange,
}: {
  section: ProgressSection
  onSectionChange: (s: ProgressSection) => void
  hasCustom: boolean
  trainingTab: TrainingTab
  onTrainingTabChange: (t: TrainingTab) => void
  program: Program
  programOptions: { value: Program; label: string }[]
  onProgramChange: (p: Program) => void
  customView: CustomProgressView
  onCustomViewChange: (v: CustomProgressView) => void
}) {
  const sectionOptions: { value: ProgressSection; label: string }[] = [
    { value: 'programs', label: pl.progressSectionPrograms },
    ...(hasCustom ? [{ value: 'custom' as const, label: pl.progressMyExercises }] : []),
    { value: 'achievements', label: pl.tabAchievements },
  ]

  return (
    <nav className="mb-4 space-y-3" aria-label={pl.navProgress}>
      <SegmentedControl
        stretch
        aria-label={pl.progressSectionNav}
        options={sectionOptions}
        value={section}
        onChange={onSectionChange}
      />

      {section === 'programs' && (
        <div className="space-y-2 border-t border-[var(--sr-border-subtle)] pt-3">
          {programOptions.length > 1 && (
            <SegmentedControl
              size="compact"
              className="flex-nowrap overflow-x-auto pb-0.5"
              aria-label={pl.progressProgramNav}
              options={programOptions}
              value={program}
              onChange={onProgramChange}
            />
          )}
          <SegmentedControl
            size="compact"
            stretch
            aria-label={pl.progressTrainingNav}
            options={[
              { value: 'overview', label: pl.tabOverview },
              { value: 'history', label: pl.tabHistory },
              { value: 'cycle', label: pl.tabCycle },
            ]}
            value={trainingTab}
            onChange={onTrainingTabChange}
          />
        </div>
      )}

      {section === 'custom' && (
        <div className="space-y-2 border-t border-[var(--sr-border-subtle)] pt-3">
          <SegmentedControl
            size="compact"
            stretch
            aria-label={pl.progressCustomNav}
            options={[
              { value: 'exercises', label: pl.progressCustomViewExercises },
              { value: 'history', label: pl.progressCustomViewHistory },
            ]}
            value={customView}
            onChange={onCustomViewChange}
          />
        </div>
      )}
    </nav>
  )
}
