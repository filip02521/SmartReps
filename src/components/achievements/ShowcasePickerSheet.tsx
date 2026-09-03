import { useEffect, useMemo, useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import {
  SHOWCASE_SLOT_COUNT,
  getShowcasePinnedIds,
  setShowcasePinnedIds,
} from '@/lib/achievements/showcase'
import type { AchievementId, LocalAchievementUnlock } from '@/lib/achievements/types'
import { AchievementTile } from './AchievementTile'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
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

  const unlockedSorted = useMemo(
    () =>
      [...unlocks].sort(
        (a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime(),
      ),
    [unlocks],
  )

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

  return (
    <Sheet open={open} onClose={onClose} title={pl.achievementsShowcasePickTitle}>
      <div className="flex flex-col gap-4">
        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.achievementsShowcasePickHint(SHOWCASE_SLOT_COUNT)}
        </p>

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
            className="flex justify-center gap-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]/80 px-3 py-3"
            aria-label={pl.achievementsShowcaseSlotsAria}
          >
            {Array.from({ length: SHOWCASE_SLOT_COUNT }, (_, i) => {
              const id = draft[i]
              const def = id ? ACHIEVEMENT_BY_ID[id] : null
              return (
                <div key={i} className="flex w-[4.5rem] flex-col items-center gap-1">
                  {def ? (
                    <AchievementTile
                      def={def}
                      unlocked
                      size="sm"
                      showCaption={false}
                      onClick={() => toggle(def.id)}
                    />
                  ) : (
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-[var(--sr-radius-lg)] border border-dashed border-[var(--sr-border-strong)] text-[var(--sr-text-muted)]"
                      aria-hidden
                    >
                      <Plus size={18} strokeWidth={1.75} />
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
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {unlockedSorted.map((u) => {
              const def = ACHIEVEMENT_BY_ID[u.id]
              if (!def) return null
              const selected = !auto && draft.includes(u.id)
              return (
                <li key={u.id} className="relative flex justify-center">
                  <AchievementTile
                    def={def}
                    unlocked
                    size="md"
                    showCaption
                    highlight={selected}
                    onClick={() => toggle(u.id)}
                  />
                  {selected && (
                    <span
                      className="pointer-events-none absolute right-1 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--sr-brand-primary)] text-[var(--sr-text-inverse)]"
                      aria-hidden
                    >
                      <Check size={12} strokeWidth={2.5} />
                    </span>
                  )}
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
