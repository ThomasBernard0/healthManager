import { matchesSearch, parisNowTime, searchKey } from '@healthmanager/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { logEntriesLogMeal, logEntriesRemove } from '../../../api/generated/endpoints/log-entries/log-entries'
import { mealsList } from '../../../api/generated/endpoints/meals/meals'
import type { MealSummaryDto } from '../../../api/generated/model'
import { formatInt, formatLastEaten, formatMacros } from '../../../core/format'
import { Bolt, Plus, Search, Star } from '../../../core/ui/icons'
import { Sheet } from '../../../core/ui/Sheet'
import { useToast } from '../../../core/ui/toastContext'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useIsDesktop } from '../../../core/useIsDesktop'
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
  const [busy, setBusy] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const desktop = useIsDesktop()

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

  const all = meals.data ?? []
  const visible = useMemo(
    () => (meals.data ?? []).filter((m) => matchesSearch(searchKey(m.name), query)),
    [meals.data, query],
  )
  const trimmed = query.trim()

  async function log(meal: MealSummaryDto) {
    if (busy) return
    setBusy(true)
    try {
      const entry = await logEntriesLogMeal({ mealId: meal.id, date, time: parisNowTime(), quantity: 1 })
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
          <Link to={MEALS_PATH} className={styles.manage}>
            {fr.add.manage}
          </Link>
        </div>
      </div>

      <label className={styles.search}>
        <Search size={18} />
        <input
          ref={searchRef}
          type="search"
          placeholder={desktop ? fr.add.searchDesktop : fr.add.search}
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
          {visible.map((meal) => (
            <li key={meal.id} className={styles.item}>
              <div className={styles.row}>
                <div className={styles.rowMain}>
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
                </div>
                <button
                  type="button"
                  className={styles.plus}
                  aria-label={fr.add.addMeal(meal.name)}
                  disabled={busy}
                  onClick={() => void log(meal)}
                >
                  <Plus />
                </button>
              </div>
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
