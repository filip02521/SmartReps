import { Card } from '@/components/ui/Card'
import { pl } from '@/i18n/pl'

export function StatTile({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <Card className="p-3 text-center sr-card">
      <p className="tabular-nums text-2xl font-bold">{value}</p>
      {highlight && <p className="text-xs text-[var(--sr-success)]">{pl.newRecord}</p>}
      <p className="text-xs text-[var(--sr-text-muted)]">{label}</p>
    </Card>
  )
}
