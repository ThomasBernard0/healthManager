import { fr } from '../../i18n/fr'
import { Sheet } from './Sheet'
import form from './form.module.css'
import styles from './ConfirmSheet.module.css'

interface ConfirmSheetProps {
  /** The question, e.g. "Supprimer « Pomme » ?" */
  title: string
  confirmLabel: string
  /** danger (default): a destructive action, in the "over" colour; accent: a harmless one. */
  tone?: 'danger' | 'accent'
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before an action (bottom sheet on mobile, centred dialog on desktop). */
export function ConfirmSheet({
  title,
  confirmLabel,
  tone = 'danger',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
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
        <button
          type="button"
          className={tone === 'accent' ? styles.accent : styles.confirm}
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}
