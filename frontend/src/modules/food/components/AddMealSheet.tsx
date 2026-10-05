import { matchesSearch, parisNowTime, searchKey } from '@healthmanager/shared'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { logEntriesLogMeal, logEntriesRemove } from '../../../api/generated/endpoints/log-entries/log-entries'
import { mealsList } from '../../../api/generated/endpoints/meals/meals'
import type { MealSummaryDto } from '../../../api/generated/model'
import { formatInt, formatLastEaten, formatMacros, formatQuantity } from '../../../core/format'
import { Bolt, Plus, Search, Star } from '../../../core/ui/icons'
import { Sheet } from '../../../core/ui/Sheet'
import { Stepper } from '../../../core/ui/Stepper'
import { useToast } from '../../../core/ui/toastContext'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { MEALS_PATH } from '../routes'
import styles from './AddMealSheet.module.css'

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

/** Ajouter un repas: Nouveau repas, Saisie rapide, and one searchable list "Mes repas" with one-tap logging. */
export function AddMealSheet({ date, today, onClose, onQuickEntry, onNewMeal, onLogged }: AddMealSheetProps) {
  const toast = useToast()
  const meals = useAsync(() => mealsList(), 'meals')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)

  const all = meals.data ?? []
  const visible = useMemo(
    () => (meals.data ?? []).filter((m) => matchesSearch(searchKey(m.name), query)),
    [meals.data, query],
  )
  const trimmed = query.trim()

  async function log(meal: MealSummaryDto, portions: number) {
    if (busy) return
    setBusy(true)
    try {
      const entry = await logEntriesLogMeal({ mealId: meal.id, date, time: parisNowTime(), quantity: portions })
      onLogged()
      onClose()
      toast({
        message: fr.add.logged(meal.name),
        action: { label: fr.entry.undo, onClick: () => void logEntriesRemove(entry.id).then(onLogged) },
      })
    } catch {
      setBusy(false)
    }
  }

  return (
    <Sheet title={fr.add.title} onClose={onClose}>
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => onNewMeal()}>
          <Plus />
          <span>{fr.add.newMeal}</span>
        </button>
        <button type="button" className={styles.action} onClick={onQuickEntry}>
          <Bolt />
          <span>{fr.add.quickEntry}</span>
        </button>
      </div>

      <div className={styles.listHeader}>
        <h3 className={styles.listTitle}>
          {fr.add.myMeals} <span className={styles.count}>· {all.length}</span>
        </h3>
        <Link to={MEALS_PATH} className={styles.manage}>
          {fr.add.manage}
        </Link>
      </div>

      <label className={styles.search}>
        <Search size={18} />
        <input
          type="search"
          placeholder={fr.add.search}
          aria-label={fr.add.searchLabel}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setExpanded(null)
          }}
        />
      </label>

      {meals.status === 'error' && !meals.data && (
        <div className={form.error} role="alert">
          {fr.common.loadError}
        </div>
      )}

      {meals.data && (visible.length > 0 || trimmed) && (
        <ul className={styles.list}>
          {visible.map((meal, index) => (
            <li key={meal.id} className={styles.item}>
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.rowMain}
                  aria-expanded={expanded === meal.id}
                  onClick={() => {
                    setExpanded(expanded === meal.id ? null : meal.id)
                    setQuantity(1)
                  }}
                >
                  <span className={styles.name}>
                    {meal.name}
                    {meal.isFavorite && <Star className={styles.star} aria-label={fr.add.favorite} />}
                  </span>
                  <span className={styles.meta}>
                    {[
                      `${formatInt(meal.totals.kcal)} ${fr.common.kcal}`,
                      formatMacros(meal.totals),
                      meal.lastEatenOn && formatLastEaten(meal.lastEatenOn, today),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
                <button
                  type="button"
                  className={index === 0 && !trimmed ? styles.plusPrimary : styles.plus}
                  aria-label={fr.add.addMeal(meal.name)}
                  disabled={busy}
                  onClick={() => void log(meal, 1)}
                >
                  <Plus />
                </button>
              </div>
              {expanded === meal.id && (
                <div className={styles.portions}>
                  <div className={styles.stepper}>
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
                  <button
                    type="button"
                    className={form.secondary}
                    disabled={busy}
                    onClick={() => void log(meal, quantity)}
                  >
                    {fr.add.addPortions(formatQuantity(quantity))}
                  </button>
                </div>
              )}
            </li>
          ))}
          {trimmed && visible.length === 0 && (
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
