import type { LucideIcon } from 'lucide-react'
import { BarChart2, Check, Cloud, Dumbbell, Minus, Sparkles, Users } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

/** Cell value: true = included (✓), false = not included (—), string = text chip. */
type Cell = boolean | string

type Row = { label: string; free: Cell; pro: Cell }

type Category = {
  title: string
  icon: LucideIcon
  /** Brand-accented category (AI Coach — the main value driver). */
  highlight?: boolean
  /** ProFeature keys covered by this category — for ?feature= deep links. */
  featureKeys?: string[]
  rows: Row[]
}

/**
 * Free vs Pro comparison table for the /pro page.
 * Semantic <table> for accessibility — check/minus icons carry sr-only labels
 * so screen readers announce "Included"/"Not included", not silence.
 *
 * Row order is deliberate: the first category shows how much Free includes
 * (growth driver — don't scare users), differences come after.
 */
export function PlanComparisonTable({
  /** Feature key to highlight (deep-linked from a ProTeaser via ?feature=). */
  highlightFeature,
}: {
  highlightFeature?: string | null
}) {
  const categories: Category[] = [
    {
      title: pl.proCatTraining,
      icon: Dumbbell,
      rows: [
        { label: pl.proRowCycles, free: true, pro: true },
        { label: pl.proRowCustomPlans, free: pl.proValThree, pro: pl.proValUnlimited },
        { label: pl.proRowLocalInsights, free: true, pro: true },
      ],
    },
    {
      title: pl.proCatAi,
      icon: Sparkles,
      highlight: true,
      featureKeys: ['hostedAi'],
      rows: [
        { label: pl.proRowAiInsight, free: false, pro: true },
        { label: pl.proRowAiAnalysis, free: false, pro: true },
        { label: pl.proRowAiGenerator, free: false, pro: true },
        { label: pl.proRowAiAdaptive, free: false, pro: true },
        { label: pl.proRowAiByok, free: false, pro: true },
      ],
    },
    {
      title: pl.proCatStats,
      icon: BarChart2,
      featureKeys: ['advancedAnalytics', 'streakFreeze'],
      rows: [
        { label: pl.proRowBasicStats, free: true, pro: true },
        { label: pl.proRowAdvancedStats, free: false, pro: true },
        { label: pl.proRowForecasts, free: false, pro: true },
        { label: pl.proRowStreakFreeze, free: false, pro: pl.proValAuto },
      ],
    },
    {
      title: pl.proCatCommunity,
      icon: Users,
      featureKeys: ['unlimitedPublications', 'profileTitle'],
      rows: [
        { label: pl.proRowCommunityBrowse, free: true, pro: true },
        { label: pl.proRowFollow, free: true, pro: true },
        { label: pl.proRowPublish, free: pl.proValThree, pro: pl.proValUnlimited },
        { label: pl.proRowProfileTitle, free: false, pro: pl.proValAutoManual },
      ],
    },
    {
      title: pl.proCatData,
      icon: Cloud,
      featureKeys: ['cloudSync', 'export', 'webPush', 'manualShowcase', 'unlimitedCustomPlans'],
      rows: [
        { label: pl.proRowReminders, free: true, pro: true },
        { label: pl.proRowCloudSync, free: true, pro: true },
        { label: pl.proRowExportJson, free: true, pro: true },
        { label: pl.proRowExport, free: false, pro: true },
        { label: pl.proRowPush, free: false, pro: true },
        { label: pl.proRowShowcase, free: true, pro: true },
      ],
    },
  ]

  return (
    <div
      className="overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]"
      style={{ boxShadow: 'var(--sr-shadow-card)' }}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--sr-border-subtle)]">
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">{pl.proComparisonTitle}</span>
            </th>
            <th
              scope="col"
              className="w-[4.5rem] px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]"
            >
              {pl.proFreeCol}
            </th>
            <th scope="col" className="w-[4.5rem] px-2 py-3 text-center">
              <span className="inline-flex items-center justify-center rounded-[var(--sr-radius-full)] bg-[image:var(--sr-brand-gradient)] px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-white">
                {pl.proBadge}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat, ci) => {
            const isTargeted =
              highlightFeature != null && cat.featureKeys?.includes(highlightFeature)
            return (
              <CategoryBlock
                key={cat.title}
                category={cat}
                targeted={isTargeted ?? false}
                first={ci === 0}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CategoryBlock({
  category,
  targeted,
  first,
}: {
  category: Category
  targeted: boolean
  first: boolean
}) {
  const Icon = category.icon
  const accent = category.highlight || targeted
  return (
    <>
      <tr
        data-pro-feature={category.featureKeys?.join(' ') || undefined}
        className={cn(
          !first && 'border-t border-[var(--sr-border-subtle)]',
          accent && 'bg-[var(--sr-brand-primary-muted)]/50',
        )}
      >
        <th
          scope="rowgroup"
          colSpan={3}
          className={cn(
            'px-4 pb-1 pt-4 text-xs font-bold uppercase tracking-wide',
            accent
              ? 'text-[var(--sr-brand-primary-hover)]'
              : 'text-[var(--sr-text-secondary)]',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Icon size={13} aria-hidden />
            {category.title}
          </span>
        </th>
      </tr>
      {category.rows.map((row, i) => (
        <tr
          key={row.label}
          className={cn(
            i < category.rows.length - 1 && 'border-b border-[var(--sr-border-subtle)]/40',
            accent && 'bg-[var(--sr-brand-primary-muted)]/50',
          )}
        >
          <td className="px-4 py-2.5 text-[13px] leading-snug text-[var(--sr-text-primary)]">
            {row.label}
          </td>
          <td className="px-2 py-2.5 text-center">
            <CellValue value={row.free} />
          </td>
          <td className="px-2 py-2.5 text-center">
            <CellValue value={row.pro} pro />
          </td>
        </tr>
      ))}
    </>
  )
}

function CellValue({ value, pro }: { value: Cell; pro?: boolean }) {
  if (typeof value === 'string') {
    return (
      <span
        className={cn(
          'inline-block rounded-[var(--sr-radius-full)] px-2 py-0.5 text-[0.625rem] font-semibold leading-tight',
          pro
            ? 'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary-hover)]'
            : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-secondary)]',
        )}
      >
        {value}
      </span>
    )
  }
  return value ? (
    <span className="inline-flex items-center justify-center">
      <Check
        size={16}
        strokeWidth={2.5}
        className={pro ? 'text-[var(--sr-brand-primary-hover)]' : 'text-[var(--sr-success)]'}
        aria-hidden
      />
      <span className="sr-only">{pl.proFeatureIncluded}</span>
    </span>
  ) : (
    <span className="inline-flex items-center justify-center">
      <Minus size={16} className="text-[var(--sr-text-muted)]/60" aria-hidden />
      <span className="sr-only">{pl.proFeatureNotIncluded}</span>
    </span>
  )
}
