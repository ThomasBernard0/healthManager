import { useState } from 'react'
import { logEntriesRemove, logEntriesRestore } from '../../../api/generated/endpoints/log-entries/log-entries'
import type { LogEntryDto } from '../../../api/generated/model'
import { formatInt, formatMacros } from '../../../core/format'
import { Sheet } from '../../../core/ui/Sheet'
import { useToast } from '../../../core/ui/toastContext'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import styles from './EntrySheet.module.css'

interface EntrySheetProps {
  entry: LogEntryDto
  onClose: () => void
  /** Called after any change so the day reloads. */
  onChanged: () => void
}

/** Tap on a logged meal: its totals, and delete it (with undo). Time and portions are set when logging. */
export function EntrySheet({ entry, onClose, onChanged }: EntrySheetProps) {
  const toast = useToast()
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')

  async function remove() {
    setState('busy')
    try {
      await logEntriesRemove(entry.id)
    } catch {
      setState('error')
      return
    }
    onClose()
    onChanged()
    toast({
      message: fr.entry.deleted,
      action: {
        label: fr.entry.undo,
        onClick: () => {
          void logEntriesRestore({
            date: entry.date,
            time: entry.time,
            kind: entry.kind,
            mealId: entry.mealId,
            label: entry.label,
            quantity: entry.quantity,
            snapshot: entry.snapshot,
          }).then(onChanged)
        },
      },
    })
  }

  return (
    <Sheet title={entry.label} onClose={onClose}>
      <div className={styles.total}>
        <span className={styles.totalKcal}>
          {formatInt(entry.total.kcal)} {fr.common.kcal}
        </span>
        <span className={styles.totalMacros}>{formatMacros(entry.total)}</span>
      </div>

      <div className={styles.time}>
        <span>{fr.entry.time}</span>
        <span className={styles.timeValue}>{entry.time}</span>
      </div>

      {state === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.saveError}
        </div>
      )}

      <button type="button" className={form.danger} disabled={state === 'busy'} onClick={() => void remove()}>
        {fr.entry.delete}
      </button>
    </Sheet>
  )
}
