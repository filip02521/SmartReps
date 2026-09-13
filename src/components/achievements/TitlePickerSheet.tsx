import { useEffect, useMemo, useState } from 'react'
import { Check, Crown, Lock } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { ProTeaser } from '@/components/ux/ProTeaser'
import { pl } from '@/i18n/pl'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { useProFeatures } from '@/lib/subscription'
import { showToast } from '@/stores/toast-store'
import { AnalyticsEvents, track } from '@/lib/analytics'
import { getMyPublicProfile, upsertMyPublicProfile } from '@/lib/follow-system'
import { pushProfileSettingsOnly } from '@/lib/sync'
import { TITLE_IDS, getProfileTitle, titleRarity } from '@/lib/achievements/titles'
import { achievementRarityLabel, achievementTitle } from '@/lib/achievements/copy'
import type { AchievementId, AchievementRarity, LocalAchievementUnlock } from '@/lib/achievements/types'

const RARITY_RANK: Record<AchievementRarity, number> = {
  legendary: 3,
  rare: 2,
  common: 1,
}

function rarityTextClass(rarity: AchievementRarity): string {
  switch (rarity) {
    case 'legendary':
      return 'text-[var(--sr-warning)]'
    case 'rare':
      return 'text-[var(--sr-info)]'
    default:
      return 'text-[var(--sr-text-primary)]'
  }
}

/**
 * Profile title picker — lists every title-granting achievement, unlocked
 * ones selectable (Pro). Free users see the full catalog as a teaser and hit
 * the paywall on save.
 */
export function TitlePickerSheet({
  open,
  onClose,
  unlocks,
}: {
  open: boolean
  onClose: () => void
  unlocks: LocalAchievementUnlock[]
}) {
  const pro = useProFeatures()
  const selectedTitle = useAppStore((s) => s.settings.selectedTitle)
  const setSettings = useAppStore((s) => s.setSettings)
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [teaserOpen, setTeaserOpen] = useState(false)

  useEffect(() => {
    if (open) setDraft(selectedTitle)
  }, [open, selectedTitle])

  const unlockedIds = useMemo(() => new Set<string>(unlocks.map((u) => u.id)), [unlocks])

  // Unlocked first (rarity desc, then label), locked titles at the bottom.
  const { unlockedRows, lockedRows } = useMemo(() => {
    const eligible = TITLE_IDS.map((id) => ({
      id,
      title: getProfileTitle(id) ?? id,
      achievement: achievementTitle(id as AchievementId),
      rarity: titleRarity(id) ?? ('common' as const),
      unlocked: unlockedIds.has(id),
    })).sort((a, b) => {
      if (a.rarity !== b.rarity) return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity]
      return a.title.localeCompare(b.title)
    })
    return {
      unlockedRows: eligible.filter((r) => r.unlocked),
      lockedRows: eligible.filter((r) => !r.unlocked),
    }
  }, [unlockedIds])

  function pick(id: string | null) {
    // Free users hit the paywall on ANY non-null pick — a locked row and an
    // unlocked row both lead to Pro. Clearing the title is always allowed:
    // the server only validates non-empty values, and a lapsed Pro user must
    // be able to remove a stale title.
    if (id !== null && !pro) {
      setTeaserOpen(true)
      return
    }
    if (id !== null && !unlockedIds.has(id)) return
    setDraft(id)
  }

  async function save() {
    // Nothing changed — close quietly instead of a pointless server roundtrip
    // (which a lapsed Pro user would fail on anyway).
    if (draft === selectedTitle) {
      onClose()
      return
    }
    if (!pro && draft !== null) {
      setTeaserOpen(true)
      return
    }
    setBusy(true)
    try {
      setSettings({ selectedTitle: draft })
      // Push the private setting first — it must reach `profiles` even when
      // the public-profile upsert below fails (offline, no public profile).
      void pushProfileSettingsOnly()
      // Keep the public copy in sync — the server validates Pro + that the
      // achievement is actually unlocked. '' clears; the row may not exist
      // yet (private profile) — then skip quietly.
      const existing = await getMyPublicProfile().catch(() => null)
      if (existing) {
        await upsertMyPublicProfile({
          displayName: existing.display_name,
          bio: existing.bio,
          isPublic: existing.is_public,
          showcaseSlots: existing.showcase_slots,
          titleAchievementId: draft ?? '',
        })
      }
      track(AnalyticsEvents.profileTitleSet, { title: draft ?? 'none' })
      showToast(pl.profileTitleSaved, 'success')
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'title_requires_pro') showToast(pl.profileTitleProRequired, 'warning')
      else showToast(pl.profileTitleSaveError, 'error')
      // Roll back the optimistic local write on a hard server rejection.
      if (msg === 'title_requires_pro' || msg === 'title_not_unlocked' || msg === 'title_not_eligible') {
        setSettings({ selectedTitle })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={pl.profileTitlePickTitle}>
        <div className="flex flex-col gap-4">
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.profileTitlePickHint}
          </p>

          <ul className="flex flex-col gap-1.5" role="radiogroup" aria-label={pl.profileTitlePickTitle}>
            <li>
              <button
                type="button"
                role="radio"
                aria-checked={draft === null}
                onClick={() => pick(null)}
                className={cn(
                  FOCUS_RING,
                  'flex w-full items-center gap-3 rounded-[var(--sr-radius-md)] border px-3 py-2.5 text-left transition-colors',
                  draft === null
                    ? 'border-[var(--sr-brand-primary)] bg-[color-mix(in_srgb,var(--sr-brand-primary)_8%,var(--sr-bg-surface))]'
                    : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] hover:bg-[var(--sr-bg-elevated)]',
                )}
              >
                <span className="sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
                  {pl.profileTitleNone}
                </span>
                {draft === null && (
                  <Check size={16} className="ml-auto shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
                )}
              </button>
            </li>
            {unlockedRows.length > 0 && (
              <>
                <li aria-hidden className="sr-text-overline px-1 pt-2 font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
                  {pl.profileTitleGroupUnlocked(unlockedRows.length)}
                </li>
                {unlockedRows.map((row) => (
                  <TitleRow key={row.id} row={row} draft={draft} busy={busy} onPick={pick} />
                ))}
              </>
            )}
            {lockedRows.length > 0 && (
              <>
                <li aria-hidden className="sr-text-overline px-1 pt-3 font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
                  {pl.profileTitleGroupLocked(lockedRows.length)}
                </li>
                {lockedRows.map((row) => (
                  <TitleRow key={row.id} row={row} draft={draft} busy={busy} onPick={pick} />
                ))}
              </>
            )}
          </ul>

          {/* Sticky footer — 42 titles scroll above; save stays reachable.
              Negative margins extend the bg over the sheet panel padding. */}
          <div className="sticky bottom-0 -mx-6 -mb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] mt-1 flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3">
            <Button type="button" size="touch" fullWidth onClick={save} disabled={busy} className={FOCUS_RING}>
              {pl.achievementsShowcaseSave}
            </Button>
            <Button type="button" size="md" variant="ghost" fullWidth onClick={onClose}>
              {pl.cancel}
            </Button>
          </div>
        </div>
      </Sheet>
      <ProTeaser open={teaserOpen} onClose={() => setTeaserOpen(false)} feature="profileTitle" />
    </>
  )
}

type TitleRowData = {
  id: string
  title: string
  achievement: string
  rarity: AchievementRarity
  unlocked: boolean
}

function TitleRow({
  row,
  draft,
  busy,
  onPick,
}: {
  row: TitleRowData
  draft: string | null
  busy: boolean
  onPick: (id: string) => void
}) {
  const selected = draft === row.id
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        // Locked rows stay focusable so the "Odblokuj: X" hint is reachable —
        // pick() itself refuses them. aria-disabled keeps radio semantics.
        aria-disabled={!row.unlocked || undefined}
        disabled={busy}
        onClick={() => onPick(row.id)}
        className={cn(
          FOCUS_RING,
          'flex w-full items-center gap-3 rounded-[var(--sr-radius-md)] border px-3 py-2.5 text-left transition-colors',
          selected
            ? 'border-[var(--sr-brand-primary)] bg-[color-mix(in_srgb,var(--sr-brand-primary)_8%,var(--sr-bg-surface))]'
            : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] hover:bg-[var(--sr-bg-elevated)]',
          !row.unlocked && 'opacity-55',
        )}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'flex items-center gap-1.5 sr-text-body-sm font-semibold',
              row.unlocked ? rarityTextClass(row.rarity) : 'text-[var(--sr-text-muted)]',
            )}
          >
            {row.title}
            {row.rarity === 'legendary' && (
              <Crown size={13} className="shrink-0 text-[var(--sr-warning)]" aria-hidden />
            )}
          </span>
          <span className="mt-0.5 block truncate sr-text-caption text-[var(--sr-text-muted)]">
            {row.unlocked
              ? pl.profileTitleUnlockedBy(row.achievement)
              : pl.profileTitleLockedBy(row.achievement)}
          </span>
        </span>
        <span className="sr-text-caption shrink-0 text-[var(--sr-text-muted)]">
          {achievementRarityLabel(row.rarity)}
        </span>
        {!row.unlocked ? (
          <Lock size={14} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
        ) : selected ? (
          <Check size={16} className="shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
        ) : null}
      </button>
    </li>
  )
}
