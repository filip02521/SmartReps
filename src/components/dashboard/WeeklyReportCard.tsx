import { AiInsightCard } from '@/components/brand/AiInsightCard'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { showToast } from '@/stores/toast-store'
import type { LocalAiInsight } from '@/lib/db'

export function WeeklyReportCard({
  insight,
  onDismissed,
}: {
  insight: LocalAiInsight
  onDismissed?: () => void
}) {
  if (insight.dismissedAt) return null

  return (
    <AiInsightCard
      insight={insight}
      className="mb-6"
      onDismiss={async () => {
        const dismissed = { ...insight, dismissedAt: new Date().toISOString() }
        await db.aiInsights.put(dismissed)
        void enqueueSync('ai_insights', 'update', dismissed)
        showToast(pl.coachPostWorkoutDismissed, 'info')
        onDismissed?.()
      }}
    />
  )
}
