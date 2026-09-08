import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InfoHint } from '@/components/ui/InfoHint'
import { pl } from '@/i18n/pl'

export function ProfileDataSection({
  showDeleteAccount,
  onImport,
  onExportJson,
  onExportCsv,
  onClearLocal,
  onDeleteAccount,
}: {
  showDeleteAccount: boolean
  onImport: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onClearLocal: () => void
  onDeleteAccount: () => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-stretch gap-2">
        <Button
          variant="secondary"
          size="md"
          className="flex-1 justify-start px-4"
          onClick={onImport}
        >
          {pl.importBackupTitle}
        </Button>
        <InfoHint text={pl.profileDataImportHint} className="shrink-0 self-center" />
      </div>

      <div className="flex items-stretch gap-2">
        <Button
          variant="secondary"
          size="md"
          className="flex-1 justify-start px-4"
          onClick={onExportJson}
        >
          {pl.exportBackupJson}
        </Button>
        <InfoHint text={pl.profileDataExportJsonHint} className="shrink-0 self-center" />
      </div>

      <div className="flex items-stretch gap-2">
        <Button
          variant="secondary"
          size="md"
          className="flex-1 justify-start px-4"
          onClick={onExportCsv}
        >
          {pl.exportAllPrograms}
        </Button>
        <InfoHint text={pl.profileDataExportCsvHint} className="shrink-0 self-center" />
      </div>

      <div className="mt-3 border-t border-[var(--sr-border-subtle)] pt-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0 text-[var(--sr-error)]" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
            {pl.profileDangerZone}
          </p>
          <InfoHint text={pl.profileDangerZoneHint} className="ml-0.5 shrink-0" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-stretch gap-2">
            <Button
              variant="ghost"
              size="md"
              className="flex-1 justify-start px-4 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
              onClick={onClearLocal}
            >
              {pl.clearLocalData}
            </Button>
            <InfoHint text={pl.profileDataClearHint} className="shrink-0 self-center" />
          </div>
          {showDeleteAccount && (
            <div className="flex items-stretch gap-2">
              <Button
                variant="ghost"
                size="md"
                className="flex-1 justify-start px-4 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
                onClick={onDeleteAccount}
              >
                {pl.deleteAccount}
              </Button>
              <InfoHint text={pl.profileDataDeleteHint} className="shrink-0 self-center" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
