import { TIME_PATTERN } from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import {
  logEntriesRemove,
  logEntriesRestore,
  logEntriesUpdate,
} from '../../../api/generated/endpoints/log-entries/log-entries'
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

/** Tap on a logged meal: its totals, change its time (starts at the logged time), delete it (with undo). */
export function EntrySheet({ entry, onClose, onChanged }: EntrySheetProps) {
  const toast = useToast()
  const [time, setTime] = useState(entry.time)
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const changed = time !== entry.time

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!changed || !TIME_PATTERN.test(time)) return
    setState('busy')
    try {
      await logEntriesUpdate(entry.id, { time })
    } catch {
      setState('error')
      return
    }
    onClose()
    onChanged()
  }

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

      <form className={styles.form} onSubmit={(e) => void save(e)}>
        <label className={form.row}>
          <span>{fr.entry.time}</span>
          <input
            className={form.inlineInput}
            type="time"
            aria-label={fr.entry.timeLabel}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </label>
        <button className={form.primary} type="submit" disabled={!changed || state === 'busy'}>
          {fr.common.save}
        </button>
      </form>

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
