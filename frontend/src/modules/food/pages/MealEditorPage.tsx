import {
  ingredientNutrients,
  isIsoDate,
  mealTotals,
  type Nutrients,
  parisNowTime,
  parisToday,
  roundKcal,
  roundMacro,
} from '@healthmanager/shared'
import { useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  logEntriesCreateQuick,
  logEntriesLogMeal,
} from '../../../api/generated/endpoints/log-entries/log-entries'
import {
  mealsCreate,
  mealsGet,
  mealsRemove,
  mealsUpdate,
} from '../../../api/generated/endpoints/meals/meals'
import type { FoodDto, MealDto, SaveMealDto } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import { formatDayMonth, formatDecimal, formatInt, formatMacros, parseNumber } from '../../../core/format'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { Barcode, ChevronLeft } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { AmountSheet, type Amount } from '../components/AmountSheet'
import { FoodPickerSheet } from '../components/FoodPickerSheet'
import { NewFoodSheet } from '../components/NewFoodSheet'
import { dayPath } from '../routes'
import { ScanSheet } from '../scanner/ScanSheet'
import styles from './MealEditorPage.module.css'

type Mode = 'ingredients' | 'manual'
type NutrientFields = Record<keyof Nutrients, string>

interface Ingredient extends Amount {
  key: string
  food: FoodDto
}

/** Values carried over from Saisie rapide ("Plutôt l'enregistrer dans Mes repas"). */
export interface MealDraft {
  name?: string
  manual?: NutrientFields
}

const EMPTY_FIELDS: NutrientFields = { kcal: '', protein: '', carbs: '', fat: '' }
const NUTRIENT_KEYS = ['kcal', 'protein', 'carbs', 'fat'] as const
const MACROS = [
  { key: 'protein', label: fr.macros.protein, aria: fr.quick.proteinGrams },
  { key: 'carbs', label: fr.macros.carbs, aria: fr.quick.carbsGrams },
  { key: 'fat', label: fr.macros.fat, aria: fr.quick.fatGrams },
] as const

const toFields = (n: Nutrients): NutrientFields => ({
  kcal: String(n.kcal),
  protein: formatDecimal(n.protein),
  carbs: formatDecimal(n.carbs),
  fat: formatDecimal(n.fat),
})

/** Typed fields → Nutrients (kcal required, empty macro = 0), or null if invalid. */
function parseFields(f: NutrientFields): Nutrients | null {
  const kcal = parseNumber(f.kcal)
  const macros = [f.protein, f.carbs, f.fat].map((v) => (v.trim() === '' ? 0 : parseNumber(v)))
  if (kcal === null || kcal < 0 || macros.some((m) => m === null || m < 0)) return null
  const [protein, carbs, fat] = macros as number[]
  return { kcal: roundKcal(kcal), protein: roundMacro(protein), carbs: roundMacro(carbs), fat: roundMacro(fat) }
}

let keySeq = 0
const nextKey = () => `i${++keySeq}`

/** Nouveau repas (/repas/nouveau) and editing a saved meal (/repas/:id). */
export default function MealEditorPage() {
  const { id } = useParams()
  const existing = useAsync(() => (id ? mealsGet(id) : Promise.resolve(null)), id ?? 'new')
  if (id && existing.status !== 'ok') {
    return (
      <div className={styles.page}>
        {existing.status === 'error' && (
          <div className={form.error} role="alert">
            {fr.common.loadError}
          </div>
        )}
      </div>
    )
  }
  return <MealEditor key={id ?? 'new'} meal={existing.data ?? null} />
}

function MealEditor({ meal }: { meal: MealDto | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const draft = (location.state as { draft?: MealDraft } | null)?.draft
  const today = parisToday()
  const dateParam = params.get('date')
  const date = dateParam && isIsoDate(dateParam) ? dateParam : today

  const [name, setName] = useState(meal?.name ?? draft?.name ?? params.get('nom') ?? '')
  const [mode, setMode] = useState<Mode>(meal?.mode ?? (draft?.manual ? 'manual' : 'ingredients'))
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    () =>
      meal?.items.map((i) => ({
        key: nextKey(),
        food: i.food,
        grams: i.grams,
        unitLabel: i.unitLabel,
        unitCount: i.unitCount,
      })) ?? [],
  )
  const [manual, setManual] = useState<NutrientFields>(
    meal?.manualTotals ? toFields(meal.manualTotals) : (draft?.manual ?? EMPTY_FIELDS),
  )
  const [override, setOverride] = useState<NutrientFields | null>(meal?.override ? toFields(meal.override) : null)
  const [saveToMeals, setSaveToMeals] = useState(true)
  const [favorite, setFavorite] = useState(meal?.isFavorite ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [overlay, setOverlay] = useState<
    | { kind: 'pick' }
    | { kind: 'scan' }
    | { kind: 'newFood'; name: string; barcode?: string }
    | { kind: 'amount'; food: FoodDto; index: number | null }
    | null
  >(null)

  const manualTotals = parseFields(manual)
  const overrideTotals = override ? parseFields(override) : null
  const computed = mealTotals({
    mode,
    items: ingredients.map((i) => ({ per100g: i.food.per100g, grams: i.grams })),
    manualTotals,
    override: overrideTotals,
  })

  const isNew = meal === null
  const saving = isNew ? saveToMeals : true
  const valid =
    (!saving || name.trim().length > 0) &&
    (mode === 'ingredients' ? ingredients.length > 0 : manualTotals !== null) &&
    (override === null || overrideTotals !== null)

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(dayPath()))

  function dto(): SaveMealDto {
    return {
      name: name.trim(),
      mode,
      items:
        mode === 'ingredients'
          ? ingredients.map((i) => ({
              foodId: i.food.id,
              grams: roundMacro(i.grams),
              unitLabel: i.unitLabel,
              unitCount: i.unitCount,
            }))
          : [],
      manualTotals: mode === 'manual' ? manualTotals : null,
      override: overrideTotals,
      isFavorite: favorite,
    }
  }

  async function submit() {
    if (!valid) return
    const time = parisNowTime()
    setState('saving')
    try {
      if (meal) {
        await mealsUpdate(meal.id, dto())
        invalidateData()
        back()
        return
      }
      if (saveToMeals) {
        const created = await mealsCreate(dto())
        await logEntriesLogMeal({ mealId: created.id, date, time, quantity: 1 })
      } else {
        await logEntriesCreateQuick({
          date,
          time,
          label: name.trim() || fr.quick.defaultName,
          ...computed.totals,
        })
      }
      invalidateData()
      navigate(dayPath(date), { replace: true })
    } catch {
      setState('error')
    }
  }

  /** Deletes the meal for good; days it was logged on keep their totals. */
  async function remove() {
    if (!meal) return
    setState('saving')
    try {
      await mealsRemove(meal.id)
      invalidateData()
      back()
    } catch {
      setConfirmDelete(false)
      setState('error')
    }
  }

  const confirmAmount = (food: FoodDto, index: number | null) => (amount: Amount) => {
    setIngredients((list) =>
      index === null
        ? [...list, { key: nextKey(), food, ...amount }]
        : list.map((item, i) => (i === index ? { ...item, ...amount } : item)),
    )
    setOverlay(null)
  }

  const submitLabel = !isNew
    ? fr.common.save
    : date === today
      ? saveToMeals
        ? fr.meal.saveAndAddToday
        : fr.meal.addToday
      : saveToMeals
        ? fr.meal.saveAndAddOn(formatDayMonth(date))
        : fr.meal.addOn(formatDayMonth(date))

  return (
    // Not a <form>: the sheets below are portals, and their submit events would bubble here.
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} aria-label={fr.common.back} onClick={back}>
          <ChevronLeft />
        </button>
        <h1 className={styles.title}>{isNew ? fr.meal.newTitle : fr.meal.editTitle}</h1>
        <span className={styles.spacer} />
      </header>

      <label className={form.field}>
        {fr.meal.name}
        <input
          className={form.input}
          type="text"
          value={name}
          placeholder={saving ? undefined : fr.quick.defaultName}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className={styles.segmented} role="radiogroup">
        {(['ingredients', 'manual'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={mode === m ? styles.segmentActive : styles.segment}
            onClick={() => setMode(m)}
          >
            {m === 'ingredients' ? fr.meal.byIngredients : fr.meal.byTotals}
          </button>
        ))}
      </div>

      {mode === 'ingredients' ? (
        <>
          <section className={styles.card}>
            <ul className={styles.ingredients}>
              {ingredients.map((item, index) => {
                const n = ingredientNutrients(item.food.per100g, item.grams)
                return (
                  <li key={item.key} className={styles.ingredient}>
                    <div className={styles.ingredientMain}>
                      <span className={styles.ingredientName}>{item.food.name}</span>
                      <span className={styles.ingredientMacros}>{formatMacros(n)}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.amount}
                      aria-label={fr.meal.editIngredient(item.food.name)}
                      onClick={() => setOverlay({ kind: 'amount', food: item.food, index })}
                    >
                      {item.unitLabel && item.unitCount !== null
                        ? `${formatDecimal(item.unitCount)} ${item.unitLabel}`
                        : `${formatInt(item.grams)} ${fr.common.grams}`}
                    </button>
                    <span className={styles.ingredientKcal}>{formatInt(n.kcal)}</span>
                  </li>
                )
              })}
            </ul>
            <div className={styles.addRow}>
              <button type="button" className={styles.addIngredient} onClick={() => setOverlay({ kind: 'pick' })}>
                {fr.meal.addIngredient}
              </button>
              <button type="button" className={styles.scan} onClick={() => setOverlay({ kind: 'scan' })}>
                <Barcode />
                {fr.scan.open}
              </button>
            </div>
          </section>

          <section className={styles.total}>
            <div className={styles.totalHead}>
              <span className={styles.totalLabel}>
                {computed.source === 'override' ? fr.meal.correctedTotal : fr.meal.total}
              </span>
              {override === null ? (
                <span className={styles.totalKcal}>
                  {formatInt(computed.totals.kcal)} {fr.common.kcal}
                </span>
              ) : null}
            </div>
            {override === null ? (
              <div className={styles.totalMacros}>
                <div>
                  {fr.macros.protein} <b>{formatInt(computed.totals.protein)} {fr.common.grams}</b>
                </div>
                <div>
                  {fr.macros.carbs} <b>{formatInt(computed.totals.carbs)} {fr.common.grams}</b>
                </div>
                <div>
                  {fr.macros.fat} <b>{formatInt(computed.totals.fat)} {fr.common.grams}</b>
                </div>
              </div>
            ) : (
              <div className={styles.overrideFields}>
                {NUTRIENT_KEYS.map((key) => (
                  <label key={key} className={styles.overrideField}>
                    {key === 'kcal' ? fr.food.kcal : fr.macros[key]}
                    <input
                      inputMode="decimal"
                      value={override[key]}
                      onChange={(e) => setOverride({ ...override, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            )}
            <button
              type="button"
              className={styles.correct}
              onClick={() => setOverride(override ? null : toFields(computed.totals))}
            >
              {override ? fr.meal.removeCorrection : fr.meal.correct}
            </button>
          </section>
        </>
      ) : (
        <>
          <label className={form.field}>
            {fr.quick.kcal}
            <span className={`${form.affix} ${form.hero}`}>
              <input
                className={form.affixInput}
                inputMode="numeric"
                aria-label={fr.quick.kcal}
                value={manual.kcal}
                onChange={(e) => setManual({ ...manual, kcal: e.target.value })}
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
                    value={manual[key]}
                    onChange={(e) => setManual({ ...manual, [key]: e.target.value })}
                  />
                  <span>{fr.common.grams}</span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      <section className={styles.toggles}>
        {isNew && (
          <label className={styles.toggle}>
            <span>{fr.meal.saveToMyMeals}</span>
            <input type="checkbox" checked={saveToMeals} onChange={(e) => setSaveToMeals(e.target.checked)} />
          </label>
        )}
        {saving && (
          <label className={styles.toggle}>
            <span>{fr.meal.favorite}</span>
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
          </label>
        )}
      </section>

      {state === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.saveError}
        </div>
      )}

      <button
        className={form.primary}
        type="button"
        disabled={!valid || state === 'saving'}
        onClick={() => void submit()}
      >
        {submitLabel}
      </button>
      {meal && (
        <button type="button" className={form.danger} disabled={state === 'saving'} onClick={() => setConfirmDelete(true)}>
          {fr.meal.delete}
        </button>
      )}

      {meal && confirmDelete && (
        <ConfirmSheet
          title={fr.meal.confirmDelete(meal.name)}
          confirmLabel={fr.meal.delete}
          busy={state === 'saving'}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {overlay?.kind === 'pick' && (
        <FoodPickerSheet
          onClose={() => setOverlay(null)}
          onPick={(food) => setOverlay({ kind: 'amount', food, index: null })}
          onCreate={(foodName) => setOverlay({ kind: 'newFood', name: foodName })}
        />
      )}
      {overlay?.kind === 'scan' && (
        <ScanSheet
          onClose={() => setOverlay(null)}
          onFound={(food) => setOverlay({ kind: 'amount', food, index: null })}
          onMissing={(barcode, suggestedName) => setOverlay({ kind: 'newFood', name: suggestedName ?? '', barcode })}
        />
      )}
      {overlay?.kind === 'newFood' && (
        <NewFoodSheet
          name={overlay.name}
          barcode={overlay.barcode}
          onClose={() => setOverlay({ kind: overlay.barcode ? 'scan' : 'pick' })}
          onCreated={(food) => setOverlay({ kind: 'amount', food, index: null })}
        />
      )}
      {overlay?.kind === 'amount' && (
        <AmountSheet
          food={overlay.food}
          initial={overlay.index === null ? undefined : ingredients[overlay.index]}
          onClose={() => setOverlay(null)}
          onConfirm={confirmAmount(overlay.food, overlay.index)}
          onRemove={
            overlay.index === null
              ? undefined
              : () => {
                  setIngredients((list) => list.filter((_, i) => i !== overlay.index))
                  setOverlay(null)
                }
          }
        />
      )}
    </div>
  )
}
