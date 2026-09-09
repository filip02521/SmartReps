import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { StarterTemplateCard } from './StarterTemplateCard'
import { StarterTemplatePreviewSheet } from './StarterTemplatePreviewSheet'
import { pl } from '@/i18n/pl'
import { track, AnalyticsEvents } from '@/lib/analytics'
import {
  STARTER_TEMPLATES,
  type StarterTemplate,
  type StarterTemplateCategory,
} from '@/data/starter-templates'
import { materializeStarterTemplate, starterTemplateName } from '@/lib/starter-templates'
import { showToast } from '@/stores/toast-store'

type Filter = 'all' | StarterTemplateCategory

export function StarterTemplateSheet({
  open,
  onClose,
  onActivated,
  initialPreview,
}: {
  open: boolean
  onClose: () => void
  onActivated: (planId: string) => void
  initialPreview?: StarterTemplate | null
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<StarterTemplate | null>(null)

  useEffect(() => {
    if (open) {
      track(AnalyticsEvents.starterTemplateShown)
      if (initialPreview) setPreviewTemplate(initialPreview)
    } else {
      // Resetuj stan przy zamykaniu — unikaj pokazania preview po ponownym otwarciu.
      setPreviewTemplate(null)
      setFilter('all')
    }
  }, [open, initialPreview])

  const filtered = useMemo(() => {
    if (filter === 'all') return STARTER_TEMPLATES
    return STARTER_TEMPLATES.filter((t) => t.category === filter)
  }, [filter])

  async function handleActivate(template: StarterTemplate) {
    setActivatingId(template.id)
    try {
      const plan = await materializeStarterTemplate(template)
      showToast(pl.starterActivatedToast(starterTemplateName(template)), 'success')
      onActivated(plan.id)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : pl.aiErrorGeneric
      showToast(msg, 'error')
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pl.starterSheetTitle}
      className="max-w-md"
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-[var(--sr-text-secondary)]">
          {pl.starterSheetHint}
        </p>

        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          stretch
          aria-label={pl.starterSheetTitle}
          options={[
            { value: 'all', label: pl.starterCategoryAll },
            { value: 'home', label: pl.starterCategoryHome },
            { value: 'gym', label: pl.starterCategoryGym },
            { value: 'cardio', label: pl.starterCategoryCardio },
          ]}
        />

        <div className="flex flex-col gap-3">
          {filtered.map((t) => (
            <StarterTemplateCard
              key={t.id}
              template={t}
              activating={activatingId === t.id}
              onPreview={() => {
                track(AnalyticsEvents.starterTemplatePreviewed, { templateId: t.id })
                setPreviewTemplate(t)
              }}
              onActivate={() => void handleActivate(t)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--sr-text-muted)]">
              {pl.starterEmptyCategory}
            </p>
          )}
        </div>
      </div>

      {previewTemplate && (
        <StarterTemplatePreviewSheet
          open
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onActivate={() => {
            const t = previewTemplate
            setPreviewTemplate(null)
            void handleActivate(t)
          }}
          activating={activatingId === previewTemplate.id}
        />
      )}
    </Sheet>
  )
}
