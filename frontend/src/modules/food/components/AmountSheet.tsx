import {
  ingredientNutrients,
  MAX_PORTIONS,
  portionsFromGrams,
  roundMacro,
  roundPortions,
} from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import type { FoodDto } from '../../../api/generated/model'
import { formatDecimal, formatInt, formatMacros, parseNumber } from '../../../core/format'
import { Segmented } from '../../../core/ui/Segmented'
import { Sheet } from '../../../core/ui/Sheet'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import styles from './AmountSheet.module.css'

export interface Amount {
  grams: number
  /** The count when entered in portions of the food, else null. */
  portions: number | null
}

interface AmountSheetProps {
  food: FoodDto
  initial?: Amount
  onClose: () => void
  onConfirm: (amount: Amount) => void
  /** Shown when editing an ingredient already in the meal. */
  onRemove?: () => void
}

type Unit = 'portions' | 'grams'

const UNITS = [
  { value: 'portions', label: fr.food.inPortions },
  { value: 'grams', label: fr.food.inGrams },
] as const

/** How much of an ingredient: grams, or a count of portions when the food has one. */
export function AmountSheet({ food, initial, onClose, onConfirm, onRemove }: AmountSheetProps) {
  const { portionGrams } = food
  const startInPortions = portionGrams !== null && (!initial || initial.portions !== null)
  const [unit, setUnit] = useState<Unit>(startInPortions ? 'portions' : 'grams')
  const [value, setValue] = useState(() => {
    if (!initial) return startInPortions ? '1' : '100'
    // From the grams: the food's portion may have changed since the ingredient was added.
    return formatDecimal(
      portionGrams !== null && startInPortions ? portionsFromGrams(initial.grams, portionGrams) : initial.grams,
    )
  })
  const count = parseNumber(value)
  const portions = unit === 'portions' && portionGrams !== null && count !== null ? roundPortions(count) : null
  const grams = portions !== null && portionGrams !== null ? roundMacro(portions * portionGrams) : count
  const valid = grams !== null && grams > 0 && grams <= 5000 && (portions === null || portions <= MAX_PORTIONS)
  const preview = valid ? ingredientNutrients(food.per100g, grams) : null

  /** Switching converts the value already typed (2 portions ⇄ 80 g). */
  function switchUnit(next: Unit) {
    if (next === unit || portionGrams === null) return
    if (count !== null && count > 0) {
      setValue(formatDecimal(next === 'grams' ? roundMacro(count * portionGrams) : portionsFromGrams(count, portionGrams)))
    }
    setUnit(next)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || grams === null) return
    onConfirm({ grams, portions })
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
            <span className={form.affixUnit}>
              {unit === 'portions' ? fr.food.portions(count ?? 1) : fr.common.grams}
            </span>
          </span>
        </label>

        {portionGrams !== null && (
          <Segmented label={fr.food.amountUnit} value={unit} options={UNITS} onChange={switchUnit} />
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
