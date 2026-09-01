import { Sheet } from '@/components/ui/Sheet'
import { ExerciseLibraryPanel } from '@/components/plans/ExerciseLibraryPanel'
import { pl } from '@/i18n/pl'
import type { ExerciseDefinition } from '@/lib/exercise-model'

export function ExerciseLibrarySheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  /** When set, tapping an exercise selects it (legacy; prefer inline panel). */
  onPick?: (ex: ExerciseDefinition) => void
}) {
  if (!open) return null

  return (
    <Sheet open={open} onClose={onClose} title={pl.exerciseLibrary} className="max-h-[90vh] overflow-y-auto">
      <ExerciseLibraryPanel
        mode={onPick ? 'pick' : 'manage'}
        onPick={
          onPick
            ? (ex) => {
                onPick(ex)
                onClose()
              }
            : undefined
        }
      />
    </Sheet>
  )
}
