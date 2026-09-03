import { Button } from '@/components/ui/Button'
import { PageSection } from '@/components/ui/PageSection'
import { pl } from '@/i18n/pl'

const SECTION = 'mt-5'

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
    <PageSection title={pl.dataSection} className={SECTION}>
      <div className="flex flex-col gap-2.5">
        <Button
          variant="secondary"
          size="md"
          fullWidth
          className="justify-start px-4"
          onClick={onImport}
        >
          {pl.importBackupTitle}
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          className="justify-start px-4"
          onClick={onExportJson}
        >
          {pl.exportBackupJson}
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          className="justify-start px-4"
          onClick={onExportCsv}
        >
          {pl.exportAllPrograms}
        </Button>

        <div className="mt-3 border-t border-[var(--sr-border-subtle)] pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
            {pl.profileDangerZone}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="md"
              fullWidth
              className="justify-start px-4 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
              onClick={onClearLocal}
            >
              {pl.clearLocalData}
            </Button>
            {showDeleteAccount && (
              <Button
                variant="ghost"
                size="md"
                fullWidth
                className="justify-start px-4 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
                onClick={onDeleteAccount}
              >
                {pl.deleteAccount}
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageSection>
  )
}
