import { useState } from 'react'
import { foodsSearch } from '../../../api/generated/endpoints/foods/foods'
import type { FoodDto } from '../../../api/generated/model'
import { formatInt, formatMacros } from '../../../core/format'
import { Plus, Search } from '../../../core/ui/icons'
import { Sheet } from '../../../core/ui/Sheet'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useDebounced } from '../../../core/useDebounced'
import { fr } from '../../../i18n/fr'
import styles from './FoodPickerSheet.module.css'

interface FoodPickerSheetProps {
  onClose: () => void
  onPick: (food: FoodDto) => void
  /** No suitable food: create "Mon aliment" with this name. */
  onCreate: (name: string) => void
}

/** + Ingrédient: search CIQUAL and my own foods. */
export function FoodPickerSheet({ onClose, onPick, onCreate }: FoodPickerSheetProps) {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 200)
  const results = useAsync(() => foodsSearch({ q }), q)
  const trimmed = query.trim()

  return (
    <Sheet title={fr.food.searchTitle} onClose={onClose} dismiss="back">
      <label className={styles.search}>
        <Search size={18} />
        <input
          type="search"
          placeholder={fr.food.search}
          aria-label={fr.food.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {results.status === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.loadError}
        </div>
      )}

      <ul className={styles.list}>
        {(results.data ?? []).map((food) => (
          <li key={food.id}>
            <button type="button" className={styles.row} onClick={() => onPick(food)}>
              <span className={styles.name}>
                {food.name}
                {food.brand && <span className={styles.brand}> · {food.brand}</span>}
              </span>
              <span className={styles.meta}>
                {formatInt(food.per100g.kcal)} {fr.common.kcal} {fr.food.per100g} · {formatMacros(food.per100g)}
              </span>
            </button>
          </li>
        ))}
        {trimmed && (
          <li>
            <button type="button" className={styles.create} onClick={() => onCreate(trimmed)}>
              <Plus size={18} />
              {fr.food.create(trimmed)}
            </button>
          </li>
        )}
      </ul>
    </Sheet>
  )
}
