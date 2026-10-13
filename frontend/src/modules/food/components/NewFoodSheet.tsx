import {
  isPlausiblePer100g,
  normalizeNutrients,
  type Nutrients,
  per100gFromPortion,
  portionFromPer100g,
  roundMacro,
} from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import { foodsCreate, foodsUpdate } from '../../../api/generated/endpoints/foods/foods'
import type { FoodDto } from '../../../api/generated/model'
import { formatDecimal, formatInt, formatMacros, parseNumber } from '../../../core/format'
import { Segmented } from '../../../core/ui/Segmented'
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

type Mode = 'per100g' | 'portion'
type Fields = Record<keyof Nutrients, string>

const MODES = [
  { value: 'per100g', label: fr.food.for100g },
  { value: 'portion', label: fr.food.perPortion },
] as const
const MACROS = [
  { key: 'protein', label: fr.macros.protein, aria: fr.quick.proteinGrams },
  { key: 'fat', label: fr.macros.fat, aria: fr.quick.fatGrams },
  { key: 'carbs', label: fr.macros.carbs, aria: fr.quick.carbsGrams },
] as const
const EMPTY: Fields = { kcal: '', protein: '', carbs: '', fat: '' }
const MAX_PORTION_GRAMS = 2000

const toFields = (n: Nutrients): Fields => ({
  kcal: String(n.kcal),
  protein: formatDecimal(n.protein),
  carbs: formatDecimal(n.carbs),
  fat: formatDecimal(n.fat),
})

/** Typed fields → Nutrients, or null while one of them is missing. */
function parseFields(f: Fields): Nutrients | null {
  const [kcal, protein, carbs, fat] = [f.kcal, f.protein, f.carbs, f.fat].map(parseNumber)
  if (kcal === null || protein === null || carbs === null || fat === null) return null
  return { kcal, protein, carbs, fat }
}

/** Typed weight of one portion → grams to 0.1 g, or null when it is missing or impossible. */
function parsePortionGrams(value: string): number | null {
  const grams = roundMacro(parseNumber(value) ?? 0)
  return grams > 0 && grams <= MAX_PORTION_GRAMS ? grams : null
}

/**
 * Mon aliment: a food typed per 100 g or per portion, created once and reused — or Modifier l'ingrédient
 * when `food` is given. Always saved per 100 g, with the weight of a portion when typed per portion.
 */
export function NewFoodSheet({ name: initialName, food, barcode, dismiss = 'back', onClose, onSaved }: NewFoodSheetProps) {
  // A food with a portion has its values in both forms; otherwise the numbers typed stay as they are in both modes.
  const storedPortion = food?.portionGrams ?? null
  const [name, setName] = useState(food?.name ?? initialName)
  const [mode, setMode] = useState<Mode>(storedPortion === null ? 'per100g' : 'portion')
  const [portion, setPortion] = useState(storedPortion === null ? '' : formatDecimal(storedPortion))
  const [fields, setFields] = useState<Record<Mode, Fields>>(() => {
    const per100g = food ? toFields(food.per100g) : EMPTY
    return {
      per100g,
      portion: food && storedPortion !== null ? toFields(portionFromPer100g(food.per100g, storedPortion)) : per100g,
    }
  })
  // False once a value was typed: the other mode's values are then out of date.
  const [inSync, setInSync] = useState(true)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  const values = fields[mode]
  const parsed = parseFields(values)
  const portionGrams = parsePortionGrams(portion)
  // Untouched values of a food with a portion: its stored per-100 g values, not a second rounding of them.
  const exact = mode === 'portion' && storedPortion !== null && inSync ? parseFields(fields.per100g) : null
  const per100g =
    parsed === null
      ? null
      : mode === 'per100g'
        ? normalizeNutrients(parsed)
        : portionGrams === null
          ? null
          : (exact ?? per100gFromPortion(parsed, portionGrams))
  const valid = name.trim().length > 0 && per100g !== null && isPlausiblePer100g(per100g)

  function switchMode(next: Mode) {
    if (next === mode) return
    if (storedPortion === null) {
      setFields({ ...fields, [next]: values })
    } else if (!inSync && parsed !== null && portionGrams !== null) {
      const converted = next === 'per100g' ? per100gFromPortion(parsed, portionGrams) : portionFromPer100g(parsed, portionGrams)
      setFields({ ...fields, [next]: toFields(converted) })
      setInSync(true)
    }
    setMode(next)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || per100g === null) return
    setState('saving')
    try {
      const body = {
        name: name.trim(),
        ...(food?.brand ? { brand: food.brand } : {}),
        per100g,
        portionGrams: mode === 'portion' ? portionGrams : null,
      }
      onSaved(food ? await foodsUpdate(food.id, body) : await foodsCreate({ ...body, ...(barcode ? { barcode } : {}) }))
    } catch {
      setState('error')
    }
  }

  const set = (key: keyof Fields) => (e: { target: { value: string } }) => {
    setFields({ ...fields, [mode]: { ...values, [key]: e.target.value } })
    setInSync(false)
  }

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

        <Segmented label={fr.food.valuesMode} value={mode} options={MODES} onChange={switchMode} />

        {mode === 'portion' && (
          <label className={form.field}>
            {fr.food.portionGrams}
            <span className={form.affix}>
              <input
                className={form.affixInput}
                inputMode="decimal"
                aria-label={fr.food.portionGramsAria}
                value={portion}
                onChange={(e) => {
                  setPortion(e.target.value)
                  setInSync(false)
                }}
              />
              <span className={form.affixUnit}>{fr.common.grams}</span>
            </span>
          </label>
        )}

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

        {mode === 'portion' && (
          <div className={styles.per100g}>
            <span>{fr.food.for100g}</span>
            <span className={styles.per100gValue}>
              {per100g
                ? `${formatInt(per100g.kcal)} ${fr.common.kcal} · ${formatMacros(per100g)}`
                : fr.common.noValue}
            </span>
          </div>
        )}

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
