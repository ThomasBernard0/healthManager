import { matchesSearch, searchKey } from '@healthmanager/shared'
import { useMemo, useState } from 'react'
import { foodsListAll, foodsRemove } from '../../../api/generated/endpoints/foods/foods'
import type { FoodDto, FoodInUseDto } from '../../../api/generated/model'
import { conflictBody } from '../../../api/http'
import { invalidateData, useDataVersion } from '../../../core/dataVersion'
import { formatInt, formatMacros } from '../../../core/format'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { Plus, Trash } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { NewFoodSheet } from './NewFoodSheet'
import styles from './FoodsList.module.css'

interface FoodsListProps {
  /** The page's search field (accents/case ignored). */
  query: string
}

/** Gérer → Ingrédients: every food — edit, create, delete (refused while a meal uses it). */
export function FoodsList({ query }: FoodsListProps) {
  const version = useDataVersion()
  const foods = useAsync(() => foodsListAll(), `foods#${version}`)
  const [sheet, setSheet] = useState<{ kind: 'new' } | { kind: 'edit'; food: FoodDto } | null>(null)
  const [toDelete, setToDelete] = useState<FoodDto | null>(null)
  const [deleting, setDeleting] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })

  const visible = useMemo(
    () => (foods.data ?? []).filter((f) => matchesSearch(searchKey(`${f.name} ${f.brand ?? ''}`), query)),
    [foods.data, query],
  )

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting({ busy: true, error: null })
    try {
      await foodsRemove(toDelete.id)
    } catch (error) {
      const inUse = conflictBody<FoodInUseDto>(error)
      setDeleting({ busy: false, error: inUse ? fr.food.usedBy(inUse.mealName) : fr.common.saveError })
      return
    }
    setToDelete(null)
    setDeleting({ busy: false, error: null })
    invalidateData()
  }

  return (
    <>
      {foods.status === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.loadError}
        </div>
      )}

      {visible.length > 0 && (
        <ul className={styles.list}>
          {visible.map((food) => (
            <li key={food.id} className={styles.row}>
              <button type="button" className={styles.main} onClick={() => setSheet({ kind: 'edit', food })}>
                <span className={styles.name}>
                  {food.name}
                  {food.brand && <span className={styles.brand}> · {food.brand}</span>}
                </span>
                <span className={styles.meta}>
                  {formatInt(food.per100g.kcal)} {fr.common.kcal} {fr.food.per100g} · {formatMacros(food.per100g)}
                </span>
              </button>
              <button
                type="button"
                className={styles.delete}
                aria-label={fr.meal.deleteLabel(food.name)}
                onClick={() => {
                  setDeleting({ busy: false, error: null })
                  setToDelete(food)
                }}
              >
                <Trash />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={styles.add} onClick={() => setSheet({ kind: 'new' })}>
        <Plus size={18} />
        {fr.food.newFood}
      </button>

      {sheet && (
        <NewFoodSheet
          name={sheet.kind === 'new' ? query.trim() : ''}
          food={sheet.kind === 'edit' ? sheet.food : undefined}
          dismiss="close"
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null)
            invalidateData()
          }}
        />
      )}
      {toDelete && (
        <ConfirmSheet
          title={fr.meal.confirmDelete(toDelete.name)}
          confirmLabel={fr.meal.delete}
          busy={deleting.busy}
          error={deleting.error}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}
