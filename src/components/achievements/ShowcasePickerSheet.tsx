import { useEffect, useMemo, useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { ACHIEVEMENT_BY_ID, resolveDisplayRarity } from '@/lib/achievements/catalog'
import {
  SHOWCASE_SLOT_COUNT,
  getShowcasePinnedIds,
  setShowcasePinnedIds,
  rankUnlocksForShowcase,
} from '@/lib/achievements/showcase'
import type { AchievementId, LocalAchievementUnlock } from '@/lib/achievements/types'
import { AchievementTile } from './AchievementTile'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { achievementRarityLabel } from '@/lib/achievements/copy'
import { pl } from '@/i18n/pl'
import { FOCUS_RING } from '@/lib/ui-chrome'

export function ShowcasePickerSheet({
  open,
  onClose,
  unlocks,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  unlocks: LocalAchievementUnlock[]
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<AchievementId[]>([])
  const [auto, setAuto] = useState(true)

  useEffect(() => {
    if (!open) return
    const pinned = getShowcasePinnedIds()
    setAuto(pinned === null)
    setDraft(pinned ?? [])
  }, [open])

  // Sort by rarity (legendary first), then tier level, then newest — same as auto showcase
  const unlockedSorted = useMemo(() => rankUnlocksForShowcase(unlocks), [unlocks])

  function toggle(id: AchievementId) {
    setAuto(false)
    setDraft((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= SHOWCASE_SLOT_COUNT) {
        return [...prev.slice(1), id]
      }
      return [...prev, id]
    })
  }

  function save() {
    if (auto) setShowcasePinnedIds(null)
    else setShowcasePinnedIds(draft)
    onSaved()
    onClose()
  }

  const selectedCount = auto ? 0 : draft.length

  return (
    <Sheet open={open} onClose={onClose} title={pl.achievementsShowcasePickTitle}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.achievementsShowcasePickHint(SHOWCASE_SLOT_COUNT)}
          </p>
          {!auto && (
            <span className="shrink-0 tabular-nums sr-text-caption font-medium text-[var(--sr-brand-primary)]">
              {pl.achievementsShowcaseSelectedCount(selectedCount, SHOWCASE_SLOT_COUNT)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={auto ? 'primary' : 'secondary'}
            onClick={() => {
              setAuto(true)
              setDraft([])
            }}
          >
            {pl.achievementsShowcaseAuto}
          </Button>
          {!auto && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft([])}>
              {pl.achievementsShowcaseClear}
            </Button>
          )}
        </div>

        {!auto && (
          <div
            className="flex justify-center gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]/80 px-3 py-3"
            aria-label={pl.achievementsShowcaseSlotsAria}
          >
            {Array.from({ length: SHOWCASE_SLOT_COUNT }, (_, i) => {
              const id = draft[i]
              const def = id ? ACHIEVEMENT_BY_ID[id] : null
              return (
                <div key={i} className="flex w-12 flex-col items-center gap-1">
                  {def ? (
                    <AchievementTile
                      def={def}
                      unlocked
                      tierLevel={unlocks.find((u) => u.id === def.id)?.tierLevel}
                      size="sm"
                      showCaption={false}
                      onClick={() => toggle(def.id)}
                    />
                  ) : (
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-[var(--sr-radius-lg)] border border-dashed border-[var(--sr-border-strong)] text-[var(--sr-text-muted)]"
                      aria-hidden
                    >
                      <Plus size={16} strokeWidth={1.75} />
                    </span>
                  )}
                  <span className="sr-text-caption tabular-nums text-[var(--sr-text-muted)]">
                    {i + 1}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {unlockedSorted.length === 0 ? (
          <p className="sr-text-body-sm text-[var(--sr-text-muted)]">
            {pl.achievementsShowcaseNoUnlocks}
          </p>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {unlockedSorted.map((u) => {
              const def = ACHIEVEMENT_BY_ID[u.id]
              if (!def) return null
              const selected = !auto && draft.includes(u.id)
              const rarity = resolveDisplayRarity(def, null, u.tierLevel)
              return (
                <li key={u.id} className="relative flex flex-col items-center gap-1">
                  <AchievementTile
                    def={def}
                    unlocked
                    tierLevel={u.tierLevel}
                    size="sm"
                    showCaption={false}
                    highlight={selected}
                    onClick={() => toggle(u.id)}
                  />
                  {selected && (
                    <span
                      className="pointer-events-none absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sr-brand-primary)] text-[var(--sr-text-inverse)]"
                      aria-hidden
                    >
                      <Check size={10} strokeWidth={2.5} />
                    </span>
                  )}
                  <span className="sr-text-caption text-center text-[var(--sr-text-muted)] line-clamp-1">
                    {achievementRarityLabel(rarity)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] pt-4">
          <Button type="button" size="touch" fullWidth onClick={save} className={FOCUS_RING}>
            {pl.achievementsShowcaseSave}
          </Button>
          <Button type="button" size="md" variant="ghost" fullWidth onClick={onClose}>
            {pl.cancel}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
