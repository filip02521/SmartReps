import { Dumbbell, Home, Heart, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import {
  starterTemplateName,
  starterTemplateDescription,
} from '@/lib/starter-templates'
import { starterTemplateEstimatedWeeks } from '@/data/starter-templates'
import type {
  StarterTemplate,
  StarterTemplateCategory,
  StarterTemplateDifficulty,
  StarterTemplateEquipment,
} from '@/data/starter-templates'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

const CATEGORY_ICON: Record<StarterTemplateCategory, typeof Home> = {
  home: Home,
  gym: Dumbbell,
  cardio: Heart,
}

function difficultyVariant(
  d: StarterTemplateDifficulty,
): 'success' | 'warning' | 'info' {
  if (d === 'beginner') return 'success'
  if (d === 'intermediate') return 'warning'
  return 'info'
}

function difficultyLabel(d: StarterTemplateDifficulty): string {
  if (d === 'beginner') return pl.starterDifficultyBeginner
  if (d === 'intermediate') return pl.starterDifficultyIntermediate
  return pl.starterDifficultyAdvanced
}

function equipmentLabel(e: StarterTemplateEquipment): string {
  switch (e) {
    case 'bodyweight':
      return pl.starterEquipmentBodyweight
    case 'dumbbells':
      return pl.starterEquipmentDumbbells
    case 'barbell':
      return pl.starterEquipmentBarbell
    case 'full_gym':
      return pl.starterEquipmentFullGym
    case 'kettlebell':
      return pl.starterEquipmentKettlebell
  }
}

export function StarterTemplateCard({
  template,
  onPreview,
  onActivate,
  activating,
  compact,
}: {
  template: StarterTemplate
  onPreview: () => void
  onActivate: () => void
  activating?: boolean
  compact?: boolean
}) {
  const Icon = CATEGORY_ICON[template.category]
  const weeks = starterTemplateEstimatedWeeks(template)
  const name = starterTemplateName(template)
  const desc = starterTemplateDescription(template)

  return (
    <div
      className={cn(
        'w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-4',
        compact && 'p-3',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]">
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-[var(--sr-text-primary)]">
              {name}
            </h3>
            <Badge variant={difficultyVariant(template.difficulty)}>
              {difficultyLabel(template.difficulty)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">
            {pl.starterDaysPerWeek(template.daysPerWeek)} ·{' '}
            {pl.starterEstimatedWeeks(weeks[0], weeks[1])} ·{' '}
            {equipmentLabel(template.equipment)}
          </p>
        </div>
      </div>

      {!compact && (
        <p className="mt-3 line-clamp-2 text-sm text-[var(--sr-text-secondary)]">
          {desc}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          className="flex-1"
          onClick={onPreview}
        >
          {pl.starterPreview}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="flex-1"
          disabled={activating}
          onClick={onActivate}
        >
          {activating ? pl.starterActivating : pl.starterActivate}
        </Button>
      </div>
    </div>
  )
}

/** Inline chip — compact entry point shown above the plans list. */
export function StarterTemplateChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={pl.starterChipHint}
      className={cn(
        'flex w-full items-center gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-brand-primary-muted)] px-3 py-2.5 text-left transition-colors hover:border-[var(--sr-brand-primary)]',
        FOCUS_RING,
      )}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--sr-brand-primary)] text-[var(--sr-bg-elevated)]">
        <Dumbbell size={14} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--sr-text-primary)]">
          {pl.starterChipHint}
        </p>
        <p className="truncate text-xs text-[var(--sr-text-secondary)]">
          {pl.starterChipCta}
        </p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
    </button>
  )
}
