import { isPlausiblePer100g, roundKcal, roundMacro } from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import { foodsCreate, foodsUpdate } from '../../../api/generated/endpoints/foods/foods'
import type { FoodDto } from '../../../api/generated/model'
import { formatDecimal, parseNumber } from '../../../core/format'
import { Sheet } from '../../../core/ui/Sheet'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import styles from './NewFoodSheet.module.css'

interface NewFoodSheetProps {
  name: string
  /** Editing this food instead of creating one. */
  food?: FoodDto
  /** Scanned product missing from Open Food Facts: saved with the food so the next scan finds it. */
  barcode?: string
  /** "back" inside the ingredient flow of a meal (default), "close" when opened on its own. */
  dismiss?: 'back' | 'close'
  onClose: () => void
  onSaved: (food: FoodDto) => void
}

const MACROS = [
  { key: 'protein', label: fr.macros.protein, aria: fr.quick.proteinGrams },
  { key: 'carbs', label: fr.macros.carbs, aria: fr.quick.carbsGrams },
  { key: 'fat', label: fr.macros.fat, aria: fr.quick.fatGrams },
] as const

/** Mon aliment: a food per 100 g, created once and reused — or Modifier l'ingrédient when `food` is given. */
export function NewFoodSheet({ name: initialName, food, barcode, dismiss = 'back', onClose, onSaved }: NewFoodSheetProps) {
  const [name, setName] = useState(food?.name ?? initialName)
  const [values, setValues] = useState(() =>
    food
      ? {
          kcal: String(food.per100g.kcal),
          protein: formatDecimal(food.per100g.protein),
          carbs: formatDecimal(food.per100g.carbs),
          fat: formatDecimal(food.per100g.fat),
        }
      : { kcal: '', protein: '', carbs: '', fat: '' },
  )
  // The form edits the first unit; a food's other units are kept as they are.
  const [unitLabel, setUnitLabel] = useState(food?.units[0]?.label ?? '')
  const [unitGrams, setUnitGrams] = useState(food?.units[0] ? formatDecimal(food.units[0].grams) : '')
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  const parsed = {
    kcal: parseNumber(values.kcal),
    protein: parseNumber(values.protein),
    carbs: parseNumber(values.carbs),
    fat: parseNumber(values.fat),
  }
  const grams = parseNumber(unitGrams)
  const unitValid = !unitLabel.trim() || (grams !== null && grams > 0)
  const valid =
    name.trim().length > 0 &&
    Object.values(parsed).every((v) => v !== null) &&
    isPlausiblePer100g({
      kcal: parsed.kcal ?? 0,
      protein: parsed.protein ?? 0,
      carbs: parsed.carbs ?? 0,
      fat: parsed.fat ?? 0,
    }) &&
    unitValid

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setState('saving')
    try {
      const body = {
        name: name.trim(),
        ...(food?.brand ? { brand: food.brand } : {}),
        per100g: {
          kcal: roundKcal(parsed.kcal ?? 0),
          protein: roundMacro(parsed.protein ?? 0),
          carbs: roundMacro(parsed.carbs ?? 0),
          fat: roundMacro(parsed.fat ?? 0),
        },
        units: [...(unitLabel.trim() && grams ? [{ label: unitLabel.trim(), grams }] : []), ...(food?.units.slice(1) ?? [])],
      }
      onSaved(food ? await foodsUpdate(food.id, body) : await foodsCreate({ ...body, ...(barcode ? { barcode } : {}) }))
    } catch {
      setState('error')
    }
  }

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  return (
    <Sheet title={food ? fr.food.editTitle : fr.food.newTitle} onClose={onClose} dismiss={dismiss}>
      <form className={styles.form} onSubmit={submit}>
        <label className={form.field}>
          {fr.food.name}
          <input className={form.input} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </label>

        {barcode && (
          <div className={styles.barcode}>
            <span>{fr.scan.barcode}</span>
            <span className={styles.barcodeValue}>{barcode}</span>
          </div>
        )}

        <div className={styles.group}>{fr.food.for100g}</div>

        <label className={form.field}>
          {fr.food.kcal}
          <span className={form.affix}>
            <input
              className={form.affixInput}
              inputMode="numeric"
              aria-label={fr.food.kcal}
              value={values.kcal}
              onChange={set('kcal')}
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
                  inputMode="decimal"
                  aria-label={aria}
                  value={values[key]}
                  onChange={set(key)}
                />
                <span>{fr.common.grams}</span>
              </span>
            </label>
          ))}
        </div>

        <div className={styles.unitRow}>
          <label className={form.field}>
            {fr.food.unitName}
            <input
              className={form.input}
              value={unitLabel}
              maxLength={30}
              onChange={(e) => setUnitLabel(e.target.value)}
            />
          </label>
          <label className={form.field}>
            {fr.food.unitGrams}
            <span className={form.affix}>
              <input
                className={form.affixInput}
                inputMode="decimal"
                aria-label={fr.food.unitGrams}
                value={unitGrams}
                onChange={(e) => setUnitGrams(e.target.value)}
              />
              <span>{fr.common.grams}</span>
            </span>
          </label>
        </div>

        {state === 'error' && (
          <div className={form.error} role="alert">
            {fr.common.saveError}
          </div>
        )}

        <button className={form.primary} type="submit" disabled={!valid || state === 'saving'}>
          {food ? fr.common.save : fr.food.create100}
        </button>
      </form>
    </Sheet>
  )
}
