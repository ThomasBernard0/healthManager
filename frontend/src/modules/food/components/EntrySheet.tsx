import { addDays, entryNutrients, isIsoDate, TIME_PATTERN } from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import {
  logEntriesDuplicate,
  logEntriesRemove,
  logEntriesRestore,
  logEntriesUpdate,
} from '../../../api/generated/endpoints/log-entries/log-entries'
import type { LogEntryDto } from '../../../api/generated/model'
import { formatInt, formatMacros, formatQuantity } from '../../../core/format'
import { Sheet } from '../../../core/ui/Sheet'
import { Stepper } from '../../../core/ui/Stepper'
import { useToast } from '../../../core/ui/toastContext'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import styles from './EntrySheet.module.css'

interface EntrySheetProps {
  entry: LogEntryDto
  today: string
  onClose: () => void
  /** Called after any change so the day reloads. */
  onChanged: () => void
}

/** Tap on a logged meal: edit quantity or time, duplicate to another day, delete (with undo). */
export function EntrySheet({ entry, today, onClose, onChanged }: EntrySheetProps) {
  const toast = useToast()
  const [quantity, setQuantity] = useState(entry.quantity)
  const [time, setTime] = useState(entry.time)
  const [copyDate, setCopyDate] = useState(() => (entry.date === today ? addDays(today, 1) : today))
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')

  const total = entryNutrients(entry.snapshot, quantity)
  const changed = quantity !== entry.quantity || time !== entry.time

  async function run(action: () => Promise<void>) {
    setState('busy')
    try {
      await action()
    } catch {
      setState('error')
    }
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!changed || !TIME_PATTERN.test(time)) return
    void run(async () => {
      await logEntriesUpdate(entry.id, { quantity, time })
      onClose()
      onChanged()
    })
  }

  const duplicate = () =>
    run(async () => {
      await logEntriesDuplicate(entry.id, { date: copyDate })
      onClose()
      onChanged()
      toast({ message: fr.entry.duplicated })
    })

  const remove = () =>
    run(async () => {
      await logEntriesRemove(entry.id)
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
    })

  const busy = state === 'busy'

  return (
    <Sheet title={entry.label} onClose={onClose}>
      <form className={styles.form} onSubmit={save}>
        <div className={styles.total}>
          <span className={styles.totalKcal}>
            {formatInt(total.kcal)} {fr.common.kcal}
          </span>
          <span className={styles.totalMacros}>{formatMacros(total)}</span>
        </div>

        <div className={form.field}>
          {fr.entry.quantity}
          <Stepper
            value={quantity}
            onChange={setQuantity}
            step={0.5}
            min={0.5}
            max={20}
            decreaseLabel={fr.entry.decrease}
            increaseLabel={fr.entry.increase}
          >
            {formatQuantity(quantity)}
          </Stepper>
        </div>

        <label className={form.row}>
          <span>{fr.entry.time}</span>
          <input
            className={form.inlineInput}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </label>

        <button className={form.primary} type="submit" disabled={!changed || busy}>
          {fr.common.save}
        </button>
      </form>

      <div className={styles.duplicate}>
        <label className={`${form.field} ${styles.grow}`}>
          {fr.entry.duplicateTo}
          <input
            className={form.input}
            type="date"
            value={copyDate}
            onChange={(e) => setCopyDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={form.secondary}
          disabled={busy || !isIsoDate(copyDate)}
          onClick={() => void duplicate()}
        >
          {fr.entry.duplicate}
        </button>
      </div>

      {state === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.saveError}
        </div>
      )}

      <button type="button" className={form.danger} disabled={busy} onClick={() => void remove()}>
        {fr.entry.delete}
      </button>
    </Sheet>
  )
}
