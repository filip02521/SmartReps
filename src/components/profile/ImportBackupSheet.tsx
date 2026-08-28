import { useRef, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { pl } from '@/i18n/pl'
import {
  previewCsvImport,
  previewJsonImport,
  applyCsvImport,
  applyJsonImport,
  readImportFile,
  type ImportPreview,
} from '@/lib/import-backup'
import { trackImportBackupOk, trackImportBackupFail } from '@/lib/analytics'
import { runAuthenticatedSync } from '@/lib/auth-sync'
import { showToast } from '@/stores/toast-store'

type PickMode = 'csv' | 'json'
type PendingConfirm = 'csv-replace' | 'json-progress' | 'active-workout' | null

export function ImportBackupSheet({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pickMode, setPickMode] = useState<PickMode | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const [csvMode, setCsvMode] = useState<'skip' | 'replace'>('skip')
  const [importActiveWorkout, setImportActiveWorkout] = useState(false)
  const [activeWorkoutConfirmed, setActiveWorkoutConfirmed] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)

  const reset = () => {
    setPickMode(null)
    setPreview(null)
    setImporting(false)
    setCsvMode('skip')
    setImportActiveWorkout(false)
    setActiveWorkoutConfirmed(false)
    setPendingConfirm(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handlePick = (mode: PickMode) => {
    setPickMode(mode)
    inputRef.current?.click()
  }

  const handleFile = async (file: File) => {
    if (!pickMode) return
    try {
      const text = await readImportFile(file)
      if (pickMode === 'csv') {
        const csvPreview = await previewCsvImport(text)
        if (!csvPreview.newSessions && !csvPreview.duplicateSessions) {
          trackImportBackupFail('empty_csv')
          showToast(pl.importInvalid, 'error')
          return
        }
        setCsvMode('skip')
        setPreview(csvPreview)
      } else {
        setImportActiveWorkout(false)
        setActiveWorkoutConfirmed(false)
        const jsonPreview = await previewJsonImport(text)
        setPreview(jsonPreview)
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'read_failed'
      trackImportBackupFail(reason)
      showToast(reason === 'file_too_large' ? pl.importTooLarge : pl.importInvalid, 'error')
    }
  }

  const previewMessage = (() => {
    if (!preview) return ''
    if (preview.kind === 'csv') {
      const base = pl.importCsvPreview(preview.newSessions, preview.duplicateSessions)
      if (preview.duplicateSessions > 0 && csvMode === 'replace') {
        return `${base} ${pl.importReplaceConfirmBody}`
      }
      if (preview.duplicateSessions > 0) {
        return `${base} ${pl.importCsvDuplicatesHint}`
      }
      return base
    }
    const parts = [
      pl.importJsonPreview(
        preview.newSessions,
        preview.duplicateSessions,
        preview.progressUpdates,
        preview.newTests,
      ),
    ]
    if (preview.progressConflicts > 0) {
      parts.push(pl.importProgressConflictHint)
    }
    if (preview.skipActiveWorkout && preview.activeWorkoutCount > 0) {
      parts.push(pl.importActiveWorkoutSkipped)
    }
    return parts.join(' ')
  })()

  const confirmImport = async (opts?: { withActiveWorkout?: boolean }) => {
    if (!preview) return
    const wantsActive =
      opts?.withActiveWorkout ?? activeWorkoutConfirmed ?? importActiveWorkout
    const includeActive =
      preview.kind === 'json' && wantsActive && preview.activeWorkoutCount > 0
    setImporting(true)
    try {
      if (preview.kind === 'csv') {
        const { written } = await applyCsvImport(preview, csvMode)
        trackImportBackupOk('csv', written)
        showToast(pl.importDone(written), 'success')
      } else {
        await applyJsonImport(preview, {
          sessionMode: 'skip',
          mergeProgress: true,
          importActiveWorkout: includeActive,
          mergeSettings: true,
        })
        trackImportBackupOk('json', preview.newSessions)
        showToast(pl.importDone(preview.newSessions), 'success')
      }
      await runAuthenticatedSync({ showSuccessToast: false, showFailureToast: false })
      onImported?.()
      handleClose()
    } catch {
      trackImportBackupFail('apply_failed')
      showToast(pl.importFailed, 'error')
    } finally {
      setImporting(false)
    }
  }

  const requestImport = () => {
    if (!preview) return
    if (preview.kind === 'csv' && csvMode === 'replace' && preview.duplicateSessions > 0) {
      setPendingConfirm('csv-replace')
      return
    }
    if (preview.kind === 'json') {
      if (
        preview.skipActiveWorkout &&
        preview.activeWorkoutCount > 0 &&
        !importActiveWorkout &&
        !activeWorkoutConfirmed
      ) {
        setPendingConfirm('active-workout')
        return
      }
      if (preview.progressConflicts > 0) {
        setPendingConfirm('json-progress')
        return
      }
    }
    void confirmImport()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={pickMode === 'csv' ? '.csv,text/csv' : '.json,application/json'}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void handleFile(file)
        }}
      />

      {open && !preview && (
        <Sheet open onClose={handleClose} title={pl.importBackupTitle} showClose>
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.importBackupHint}</p>
          <Button className="mt-4" fullWidth onClick={() => handlePick('csv')}>
            {pl.importCsv}
          </Button>
          <Button className="mt-2" variant="secondary" fullWidth onClick={() => handlePick('json')}>
            {pl.importJson}
          </Button>
        </Sheet>
      )}

      {preview && !pendingConfirm && (
        <ConfirmSheet
          title={pl.importConfirmTitle}
          message={previewMessage}
          confirmLabel={
            preview.kind === 'csv' && csvMode === 'replace'
              ? pl.importReplaceDuplicates
              : pl.importConfirm
          }
          onConfirm={() => requestImport()}
          onCancel={() => setPreview(null)}
          variant={csvMode === 'replace' ? 'danger' : 'primary'}
          extraActions={
            preview.kind === 'csv' && preview.duplicateSessions > 0 ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setCsvMode((mode) => (mode === 'skip' ? 'replace' : 'skip'))
                }}
              >
                {csvMode === 'skip' ? pl.importReplaceDuplicates : pl.importMergeSkipDuplicates}
              </Button>
            ) : undefined
          }
        />
      )}

      {pendingConfirm === 'csv-replace' && (
        <ConfirmSheet
          title={pl.importReplaceConfirmTitle}
          message={pl.importReplaceConfirmBody}
          confirmLabel={pl.importReplaceDuplicates}
          variant="danger"
          onConfirm={() => {
            setPendingConfirm(null)
            void confirmImport()
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {pendingConfirm === 'json-progress' && preview?.kind === 'json' && (
        <ConfirmSheet
          title={pl.importProgressConflictTitle}
          message={pl.importProgressConflictHint}
          confirmLabel={pl.importConfirm}
          onConfirm={() => {
            setPendingConfirm(null)
            void confirmImport({
              withActiveWorkout: activeWorkoutConfirmed || importActiveWorkout,
            })
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {pendingConfirm === 'active-workout' && preview?.kind === 'json' && (
        <ConfirmSheet
          title={pl.importActiveWorkoutConfirmTitle}
          message={pl.importActiveWorkoutConfirmBody}
          confirmLabel={pl.importConfirm}
          variant="danger"
          onConfirm={() => {
            setActiveWorkoutConfirmed(true)
            setImportActiveWorkout(true)
            setPendingConfirm(null)
            if (preview.progressConflicts > 0) {
              setPendingConfirm('json-progress')
              return
            }
            void confirmImport({ withActiveWorkout: true })
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {importing && (
        <div className="fixed inset-0 z-[var(--sr-z-modal)] flex items-center justify-center bg-black/40">
          <p className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] px-4 py-3 text-sm">
            {pl.importInProgress}
          </p>
        </div>
      )}
    </>
  )
}
