import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { LocalWorkoutSession } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { showToast } from '@/stores/toast-store'
import { FOCUS_RING } from '@/lib/ui-chrome'

const NOTE_MAX_LENGTH = 500

/**
 * Inline editable session note shown in session summary.
 * Loads the existing note from the session row and lets the user edit it
 * without leaving the summary page.
 */
export function SessionNoteCard({ sessionId }: { sessionId: string }) {
  const [note, setNote] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const session = await db.workoutSessions.get(sessionId)
      if (cancelled) return
      const n = session?.note ?? ''
      setNote(n)
      setDraft(n)
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      const session = await db.workoutSessions.get(sessionId)
      if (!session) return
      const updated: LocalWorkoutSession = {
        ...session,
        note: draft.trim() || undefined,
      }
      await db.workoutSessions.put(updated)
      void enqueueSync('workout_sessions', 'update', updated)
      setNote(draft.trim())
      setEditing(false)
      showToast(pl.sessionNoteSave, 'success')
    } catch {
      showToast(pl.errorCrash, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Don't render until the note has been loaded — prevents flash of "Brak notatki"
  if (note === null) return null

  if (editing) {
    return (
      <Card className="mt-4 p-4">
        <label htmlFor="session-note" className="mb-2 block sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
          {pl.sessionNoteLabel}
        </label>
        <textarea
          id="session-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          placeholder={pl.sessionNotePlaceholder}
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          className={`mt-2 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-base text-[var(--sr-text-primary)] ${FOCUS_RING}`}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="sr-text-caption tabular-nums text-[var(--sr-text-muted)]">
            {draft.length}/{NOTE_MAX_LENGTH}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={saving}
          >
            {pl.sessionNoteSave}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(note)
              setEditing(false)
            }}
            disabled={saving}
          >
            {pl.cancel}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mt-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">
            {pl.sessionNoteLabel}
          </p>
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-primary)] whitespace-pre-wrap break-words">
            {note || pl.sessionNoteEmpty}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setDraft(note)
            setEditing(true)
          }}
          aria-label={note ? pl.sessionNoteEdit : pl.sessionNoteInMenu}
        >
          <Pencil size={16} className="mr-1" aria-hidden />
          {note ? pl.sessionNoteEdit : pl.sessionNoteInMenu}
        </Button>
      </div>
    </Card>
  )
}
