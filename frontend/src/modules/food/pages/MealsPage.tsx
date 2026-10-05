import { matchesSearch, parisToday, searchKey } from '@healthmanager/shared'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { mealsList, mealsSetFlags } from '../../../api/generated/endpoints/meals/meals'
import type { MealSummaryDto } from '../../../api/generated/model'
import { formatInt, formatLastEaten, formatMacros } from '../../../core/format'
import { ChevronLeft, Search, Star, StarOutline } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { dayPath, editMealPath } from '../routes'
import styles from './MealsPage.module.css'

/** Gérer: every saved meal — edit, archive, favourite. */
export default function MealsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [archived, setArchived] = useState(false)
  const [query, setQuery] = useState('')
  const meals = useAsync(() => mealsList({ archived }), String(archived))
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const today = parisToday()

  const visible = useMemo(
    () => (meals.data ?? []).filter((m) => matchesSearch(searchKey(m.name), query)),
    [meals.data, query],
  )

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(dayPath()))

  async function toggleFavorite(meal: MealSummaryDto) {
    const next = !(favorites[meal.id] ?? meal.isFavorite)
    setFavorites((f) => ({ ...f, [meal.id]: next }))
    try {
      await mealsSetFlags(meal.id, { isFavorite: next })
    } catch {
      setFavorites((f) => ({ ...f, [meal.id]: !next }))
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} aria-label={fr.common.back} onClick={back}>
          <ChevronLeft />
        </button>
        <h1 className={styles.title}>{fr.add.myMeals}</h1>
        <span className={styles.spacer} />
      </header>

      <div className={styles.segmented} role="radiogroup">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={archived === value}
            className={archived === value ? styles.segmentActive : styles.segment}
            onClick={() => setArchived(value)}
          >
            {value ? fr.meal.archived : fr.meal.active}
          </button>
        ))}
      </div>

      <label className={styles.search}>
        <Search size={18} />
        <input
          type="search"
          placeholder={fr.add.search}
          aria-label={fr.add.searchLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {meals.status === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.loadError}
        </div>
      )}

      {visible.length > 0 && (
        <ul className={styles.list}>
          {visible.map((meal) => {
            const favorite = favorites[meal.id] ?? meal.isFavorite
            return (
              <li key={meal.id} className={styles.row}>
                <button
                  type="button"
                  className={favorite ? styles.starOn : styles.starOff}
                  aria-label={fr.add.favorite}
                  aria-pressed={favorite}
                  onClick={() => void toggleFavorite(meal)}
                >
                  {favorite ? <Star size={20} /> : <StarOutline size={20} />}
                </button>
                <button type="button" className={styles.main} onClick={() => navigate(editMealPath(meal.id))}>
                  <span className={styles.name}>{meal.name}</span>
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
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
