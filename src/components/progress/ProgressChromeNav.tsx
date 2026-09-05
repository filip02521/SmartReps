import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { pl } from '@/i18n/pl'

export type ProgressTab = 'overview' | 'history' | 'achievements'

export function ProgressChromeNav({
  tab,
  onTabChange,
}: {
  tab: ProgressTab
  onTabChange: (t: ProgressTab) => void
}) {
  const options: { value: ProgressTab; label: string }[] = [
    { value: 'overview', label: pl.tabOverview },
    { value: 'history', label: pl.tabHistory },
    { value: 'achievements', label: pl.tabAchievements },
  ]

  return (
    <nav className="mb-6" aria-label={pl.navProgress}>
      <SegmentedControl
        stretch
        aria-label={pl.progressSectionNav}
        options={options}
        value={tab}
        onChange={onTabChange}
      />
    </nav>
  )
}
