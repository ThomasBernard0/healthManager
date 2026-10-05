import { ingredientNutrients } from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import type { FoodDto } from '../../../api/generated/model'
import { formatDecimal, formatInt, formatMacros, parseNumber } from '../../../core/format'
import { Sheet } from '../../../core/ui/Sheet'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import styles from './AmountSheet.module.css'

export interface Amount {
  grams: number
  unitLabel: string | null
  unitCount: number | null
}

interface AmountSheetProps {
  food: FoodDto
  initial?: Amount
  onClose: () => void
  onConfirm: (amount: Amount) => void
  /** Shown when editing an ingredient already in the meal. */
  onRemove?: () => void
}

const GRAMS = fr.common.grams

/** How much of an ingredient: grams, or a count of one of the food's units (c. à s., pièce…). */
export function AmountSheet({ food, initial, onClose, onConfirm, onRemove }: AmountSheetProps) {
  const [unit, setUnit] = useState(initial?.unitLabel ?? GRAMS)
  const [value, setValue] = useState(() =>
    initial ? formatDecimal(initial.unitCount ?? initial.grams) : food.units.length ? '1' : '100',
  )
  const selected = food.units.find((u) => u.label === unit)
  const count = parseNumber(value)
  const grams = count === null ? null : selected ? count * selected.grams : count
  const valid = grams !== null && grams > 0 && grams <= 5000
  const preview = valid ? ingredientNutrients(food.per100g, grams) : null

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || grams === null) return
    onConfirm(
      selected
        ? { grams, unitLabel: selected.label, unitCount: count }
        : { grams, unitLabel: null, unitCount: null },
    )
  }

  return (
    <Sheet title={food.name} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <label className={form.field}>
          {fr.food.amount}
          <span className={`${form.affix} ${form.hero}`}>
            <input
              className={form.affixInput}
              type="text"
              inputMode="decimal"
              aria-label={fr.meal.ingredientAmount(food.name)}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            <span className={form.affixUnit}>{unit}</span>
          </span>
        </label>

        {food.units.length > 0 && (
          <div className={styles.units} role="radiogroup" aria-label={fr.food.unit}>
            {[GRAMS, ...food.units.map((u) => u.label)].map((label) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={unit === label}
                className={unit === label ? styles.unitActive : styles.unit}
                onClick={() => setUnit(label)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.preview}>
          <span className={styles.previewKcal}>
            {preview ? formatInt(preview.kcal) : fr.common.noValue} {fr.common.kcal}
          </span>
          <span className={styles.previewMacros}>{preview && formatMacros(preview)}</span>
        </div>

        <button className={form.primary} type="submit" disabled={!valid}>
          {fr.food.validate}
        </button>
        {onRemove && (
          <button type="button" className={form.danger} onClick={onRemove}>
            {fr.food.remove}
          </button>
        )}
      </form>
    </Sheet>
  )
}
