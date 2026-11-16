import {
  compareQuickAdd,
  matchesSearch,
  parisNowTime,
  portionFromPer100g,
  type QuickAddRow,
  searchKey,
} from '@healthmanager/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { foodsListEaten, foodsSearch } from '../../../api/generated/endpoints/foods/foods'
import {
  logEntriesLogFood,
  logEntriesLogMeal,
  logEntriesRemove,
} from '../../../api/generated/endpoints/log-entries/log-entries'
import { mealsList } from '../../../api/generated/endpoints/meals/meals'
import type { FoodDto, LogEntryDto, LogFoodDto, MealSummaryDto } from '../../../api/generated/model'
import { formatInt, formatLastEaten, formatMacros } from '../../../core/format'
import { Bolt, Plus, Search, Star } from '../../../core/ui/icons'
import { Sheet } from '../../../core/ui/Sheet'
import { useToast } from '../../../core/ui/toastContext'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useDebounced } from '../../../core/useDebounced'
import { asBackground } from '../../../core/useOverlayParam'
import { fr } from '../../../i18n/fr'
import { MEALS_PATH } from '../routes'
import { AmountSheet, type Amount } from './AmountSheet'
import styles from './AddMealSheet.module.css'

/** A row of Mes repas: a saved meal, or a food logged on its own (or found by the search). */
type Row = QuickAddRow & ({ kind: 'meal'; meal: MealSummaryDto } | { kind: 'food'; food: FoodDto })

const mealRow = (meal: MealSummaryDto): Row => ({ kind: 'meal', meal, ...meal })

/** "+" on a food: 1 portion, or 100 g for a food without one. */
const defaultAmount = (food: FoodDto): Amount =>
  food.portionGrams !== null ? { grams: food.portionGrams, portions: 1 } : { grams: 100, portions: null }

interface AddMealSheetProps {
  /** Day meals are logged to. */
  date: string
  today: string
  onClose: () => void
  onQuickEntry: () => void
  onNewMeal: (name?: string) => void
  /** After a meal was logged (or the log was undone). */
  onLogged: () => void
}

/**
 * Ajouter un repas: Nouveau repas, Saisie rapide, and one searchable list "Mes repas" with one-tap logging:
 * saved meals and the foods already logged on their own; the search also finds every food.
 */
export function AddMealSheet({ date, today, onClose, onQuickEntry, onNewMeal, onLogged }: AddMealSheetProps) {
  const toast = useToast()
  const meals = useAsync(() => mealsList(), 'meals')
  const eaten = useAsync(() => foodsListEaten(), 'eatenFoods')
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 200)
  const found = useAsync(() => (q ? foodsSearch({ q }) : Promise.resolve([])), `foods:${q}`)
  const [busy, setBusy] = useState(false)
  /** A food tapped: how much of it (AmountSheet, in place of this sheet). */
  const [amountOf, setAmountOf] = useState<FoodDto | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

  // "/" jumps to the search (desktop shortcut), unless already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.key !== '/' || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      e.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const trimmed = query.trim()
  const all = useMemo(() => {
    const foods = (eaten.data ?? []).map((e): Row => ({ kind: 'food', name: e.food.name, isFavorite: false, ...e }))
    return [...(meals.data ?? []).map(mealRow), ...foods].sort(compareQuickAdd)
  }, [meals.data, eaten.data])
  const visible = useMemo(() => {
    if (!trimmed) return all
    // The search covers every food; one already logged keeps its place in the order.
    const stats = new Map((eaten.data ?? []).map((e) => [e.food.id, e]))
    const foods = (q === trimmed ? (found.data ?? []) : []).map(
      (food): Row => ({
        kind: 'food',
        food,
        name: food.name,
        isFavorite: false,
        timesEaten: stats.get(food.id)?.timesEaten ?? 0,
        lastEatenOn: stats.get(food.id)?.lastEatenOn ?? null,
      }),
    )
    const matching = (meals.data ?? []).filter((m) => matchesSearch(searchKey(m.name), trimmed)).map(mealRow)
    return [...matching, ...foods].sort(compareQuickAdd)
  }, [all, meals.data, eaten.data, found.data, q, trimmed])
  /** No "Créer" while the food search for this query is still on its way. */
  const searched = q === trimmed && found.status !== 'loading'

  async function log(label: string, save: () => Promise<LogEntryDto>) {
    if (busy) return
    setBusy(true)
    try {
      const entry = await save()
      onLogged()
      onClose()
      toast({
        message: fr.add.logged(label),
        action: { label: fr.entry.undo, onClick: () => void logEntriesRemove(entry.id).then(onLogged) },
      })
    } catch {
      setBusy(false)
    }
  }

  const logMeal = (meal: MealSummaryDto) =>
    log(meal.name, () => logEntriesLogMeal({ mealId: meal.id, date, time: parisNowTime(), quantity: 1 }))

  function logFood(food: FoodDto, { grams, portions }: Amount) {
    const amount: Pick<LogFoodDto, 'portions' | 'grams'> = portions !== null ? { portions } : { grams }
    return log(food.name, () => logEntriesLogFood({ foodId: food.id, date, time: parisNowTime(), ...amount }))
  }

  if (amountOf) {
    return (
      <AmountSheet
        food={amountOf}
        confirmLabel={fr.add.confirm}
        onClose={() => setAmountOf(null)}
        onConfirm={(amount) => void logFood(amountOf, amount)}
      />
    )
  }

  return (
    <Sheet title={fr.add.title} onClose={onClose}>
      <button type="button" className={styles.action} onClick={onQuickEntry}>
        <Bolt />
        <span>{fr.add.quickEntry}</span>
      </button>

      <div className={styles.listHeader}>
        <h3 className={styles.listTitle}>
          {fr.add.myMeals} <span className={styles.count}>· {all.length}</span>
        </h3>
        <div className={styles.headerLinks}>
          <button type="button" className={styles.newMeal} onClick={() => onNewMeal()}>
            <Plus size={14} />
            {fr.add.newMeal}
          </button>
          {/* Gérer opens over the page, in place of this sheet (like Nouveau repas). */}
          <Link to={MEALS_PATH} replace state={{ background: asBackground(location) }} className={styles.manage}>
            {fr.add.manage}
          </Link>
        </div>
      </div>

      <label className={styles.search}>
        <Search size={18} />
        <input
          ref={searchRef}
          type="search"
          placeholder={fr.add.search}
          aria-label={fr.add.searchLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd className={styles.key}>{fr.desktop.searchKey}</kbd>
      </label>

      {meals.status === 'error' && !meals.data && (
        <div className={form.error} role="alert">
          {fr.common.loadError}
        </div>
      )}

      {meals.data && (visible.length > 0 || trimmed) && (
        <ul className={styles.list}>
          {visible.map((row) =>
            row.kind === 'meal' ? (
              <li key={`meal:${row.meal.id}`} className={styles.item}>
                <div className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.name}>
                      {row.name}
                      {row.isFavorite && <Star className={styles.star} aria-label={fr.add.favorite} />}
                    </span>
                    <span className={styles.meta}>
                      {[
                        `${formatInt(row.meal.totals.kcal)} ${fr.common.kcal}`,
                        formatMacros(row.meal.totals),
                        row.lastEatenOn && formatLastEaten(row.lastEatenOn, today),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.plus}
                    aria-label={fr.add.addMeal(row.name)}
                    disabled={busy}
                    onClick={() => void logMeal(row.meal)}
                  >
                    <Plus />
                  </button>
                </div>
              </li>
            ) : (
              <li key={`food:${row.food.id}`} className={styles.item}>
                <FoodRow
                  food={row.food}
                  lastEaten={row.lastEatenOn && formatLastEaten(row.lastEatenOn, today)}
                  busy={busy}
                  onOpen={() => setAmountOf(row.food)}
                  onAdd={() => void logFood(row.food, defaultAmount(row.food))}
                />
              </li>
            ),
          )}
          {trimmed && searched && visible.length === 0 && (
            <li className={styles.item}>
              <button type="button" className={styles.create} onClick={() => onNewMeal(trimmed)}>
                <Plus size={18} />
                {fr.add.create(trimmed)}
              </button>
            </li>
          )}
        </ul>
      )}
    </Sheet>
  )
}

interface FoodRowProps {
  food: FoodDto
  lastEaten: string | null
  busy: boolean
  /** Tap on the row: choose the amount. */
  onOpen: () => void
  /** "+": 1 portion (or 100 g) right away. */
  onAdd: () => void
}

/** A food in Mes repas: "Banane [Aliment]", "1 portion · 105 kcal · P 1 · L 0 · G 27 · hier". */
function FoodRow({ food, lastEaten, busy, onOpen, onAdd }: FoodRowProps) {
  const withPortion = food.portionGrams !== null
  const n = food.portionGrams !== null ? portionFromPer100g(food.per100g, food.portionGrams) : food.per100g
  return (
    <div className={styles.row}>
      <button type="button" className={styles.rowMain} onClick={onOpen}>
        <span className={styles.name}>
          {food.name}
          <span className={styles.tag}>{fr.add.foodTag}</span>
        </span>
        <span className={styles.meta}>
          {[
            withPortion ? fr.add.onePortion : fr.add.hundredGrams,
            `${formatInt(n.kcal)} ${fr.common.kcal}`,
            formatMacros(n),
            lastEaten,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </button>
      <button
        type="button"
        className={styles.plus}
        aria-label={withPortion ? fr.add.addFoodPortion(food.name) : fr.add.addFoodGrams(food.name)}
        disabled={busy}
        onClick={onAdd}
      >
        <Plus />
      </button>
    </div>
  )
}
