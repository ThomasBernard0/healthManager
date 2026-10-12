import { matchesSearch, parisToday, searchKey } from '@healthmanager/shared'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router-dom'
import { mealsList, mealsRemove, mealsSetFavorite } from '../../../api/generated/endpoints/meals/meals'
import type { MealSummaryDto } from '../../../api/generated/model'
import { formatInt, formatLastEaten, formatMacros } from '../../../core/format'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { ChevronLeft, Search, Star, StarOutline, Trash } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { invalidateData, useDataVersion } from '../../../core/dataVersion'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { FoodsList } from '../components/FoodsList'
import { dayPath, editMealPath } from '../routes'
import styles from './MealsPage.module.css'

const TABS = [
  ['meals', fr.add.tabMeals],
  ['foods', fr.add.tabFoods],
] as const

/** Gérer: every saved meal — edit, favourite, delete (after confirmation) — and, in its own tab, every ingredient. */
export default function MealsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('meals')
  const [query, setQuery] = useState('')
  // Reloaded after a change in the other tab: a meal's totals follow its ingredients.
  const version = useDataVersion()
  const meals = useAsync(() => mealsList(), `meals#${version}`)
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [toDelete, setToDelete] = useState<MealSummaryDto | null>(null)
  const [deleting, setDeleting] = useState<'idle' | 'busy' | 'error'>('idle')
  const today = parisToday()

  const visible = useMemo(
    () => (meals.data ?? []).filter((m) => matchesSearch(searchKey(m.name), query)),
    [meals.data, query],
  )

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(dayPath()))
  // Shown as a dialog over a page: Modifier le repas opens over that same page (back returns here).
  const background = (location.state as { background?: Location } | null)?.background
  const edit = (id: string) => navigate(editMealPath(id), background ? { state: { background } } : undefined)

  async function toggleFavorite(meal: MealSummaryDto) {
    const next = !(favorites[meal.id] ?? meal.isFavorite)
    setFavorites((f) => ({ ...f, [meal.id]: next }))
    try {
      await mealsSetFavorite(meal.id, { isFavorite: next })
    } catch {
      setFavorites((f) => ({ ...f, [meal.id]: !next }))
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting('busy')
    try {
      await mealsRemove(toDelete.id)
      invalidateData()
    } catch {
      setDeleting('error')
      return
    }
    setToDelete(null)
    setDeleting('idle')
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

      <div className={styles.segmented}>
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? styles.segmentActive : styles.segment}
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value)
              setQuery('')
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <label className={styles.search}>
        <Search size={18} />
        <input
          type="search"
          placeholder={tab === 'meals' ? fr.add.search : fr.food.search}
          aria-label={tab === 'meals' ? fr.add.searchLabel : fr.food.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {tab === 'foods' && <FoodsList query={query} />}

      {tab === 'meals' && meals.status === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.loadError}
        </div>
      )}

      {tab === 'meals' && visible.length > 0 && (
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
                <button type="button" className={styles.main} onClick={() => edit(meal.id)}>
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
                <button
                  type="button"
                  className={styles.delete}
                  aria-label={fr.meal.deleteLabel(meal.name)}
                  onClick={() => {
                    setDeleting('idle')
                    setToDelete(meal)
                  }}
                >
                  <Trash />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {toDelete && (
        <ConfirmSheet
          title={fr.meal.confirmDelete(toDelete.name)}
          confirmLabel={fr.meal.delete}
          busy={deleting === 'busy'}
          error={deleting === 'error' ? fr.common.saveError : null}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}
