import { fr } from '../../i18n/fr'
import { Sheet } from './Sheet'
import form from './form.module.css'
import styles from './ConfirmSheet.module.css'

interface ConfirmSheetProps {
  /** The question, e.g. "Supprimer « Pomme » ?" */
  title: string
  confirmLabel: string
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before a destructive action (bottom sheet on mobile, centred dialog on desktop). */
export function ConfirmSheet({ title, confirmLabel, busy = false, error, onConfirm, onCancel }: ConfirmSheetProps) {
  return (
    <Sheet title={title} onClose={onCancel}>
      {error && (
        <div className={form.error} role="alert">
          {error}
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className={form.secondary} onClick={onCancel}>
          {fr.common.cancel}
        </button>
        <button type="button" className={styles.confirm} disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}
