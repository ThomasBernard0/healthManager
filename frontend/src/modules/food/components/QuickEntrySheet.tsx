import { parisNowTime, roundKcal, roundMacro, TIME_PATTERN } from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import { logEntriesCreateQuick } from '../../../api/generated/endpoints/log-entries/log-entries'
import { formatDayMonth, parseNumber } from '../../../core/format'
import { Sheet } from '../../../core/ui/Sheet'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import styles from './QuickEntrySheet.module.css'

interface QuickEntrySheetProps {
  /** Day the entry is logged to. */
  date: string
  today: string
  onClose: () => void
  onLogged: () => void
}

const MACROS = [
  { key: 'protein', label: fr.macros.protein, aria: fr.quick.proteinGrams },
  { key: 'carbs', label: fr.macros.carbs, aria: fr.quick.carbsGrams },
  { key: 'fat', label: fr.macros.fat, aria: fr.quick.fatGrams },
] as const

type MacroKey = (typeof MACROS)[number]['key']

/** Saisie rapide: a one-time meal, logged once and never saved to Mes repas. */
export function QuickEntrySheet({ date, today, onClose, onLogged }: QuickEntrySheetProps) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [macros, setMacros] = useState<Record<MacroKey, string>>({ protein: '', carbs: '', fat: '' })
  const [time, setTime] = useState(() => parisNowTime())
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  const kcalValue = parseNumber(kcal)
  const macroValues = MACROS.map(({ key }) => parseNumber(macros[key]))
  const valid =
    kcalValue !== null &&
    kcalValue >= 0 &&
    macroValues.every((v) => v === null || v >= 0) &&
    TIME_PATTERN.test(time)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || state === 'saving') return
    setState('saving')
    const [protein, carbs, fat] = macroValues.map((v) => roundMacro(v ?? 0))
    try {
      await logEntriesCreateQuick({
        date,
        time,
        label: name.trim() || fr.quick.defaultName,
        kcal: roundKcal(kcalValue ?? 0),
        protein,
        carbs,
        fat,
      })
      onLogged()
    } catch {
      setState('error')
    }
  }

  return (
    <Sheet title={fr.quick.title} onClose={onClose} dismiss="back">
      <form className={styles.form} onSubmit={submit}>
        <label className={form.field}>
          {fr.quick.name}
          <input
            className={form.input}
            type="text"
            value={name}
            placeholder={fr.quick.defaultName}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className={form.field}>
          {fr.quick.kcal}
          <span className={`${form.affix} ${form.hero}`}>
            <input
              className={form.affixInput}
              type="text"
              inputMode="numeric"
              aria-label={fr.quick.kcal}
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              required
            />
            <span className={form.affixUnit}>{fr.common.kcal}</span>
          </span>
        </label>

        <div className={form.grid3}>
          {MACROS.map(({ key, label, aria }) => (
            <label key={key} className={form.field}>
              {label}
              <span className={form.affix}>
                <input
                  className={form.affixInput}
                  type="text"
                  inputMode="decimal"
                  aria-label={aria}
                  value={macros[key]}
                  onChange={(e) => setMacros((m) => ({ ...m, [key]: e.target.value }))}
                />
                <span>{fr.common.grams}</span>
              </span>
            </label>
          ))}
        </div>

        <label className={form.row}>
          <span>{fr.quick.time}</span>
          <input
            className={form.inlineInput}
            type="time"
            aria-label={fr.quick.timeLabel}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </label>

        {state === 'error' && (
          <div className={form.error} role="alert">
            {fr.common.saveError}
          </div>
        )}

        <button className={form.primary} type="submit" disabled={!valid || state === 'saving'}>
          {date === today ? fr.quick.addToday : fr.quick.addOn(formatDayMonth(date))}
        </button>
      </form>
    </Sheet>
  )
}
