import { matchesSearch, searchKey } from '@healthmanager/shared'
import { useMemo, useState, type ReactNode } from 'react'
import type { ExerciseDto } from '../../../api/generated/model'
import { Search } from '../../../core/ui/icons'
import { fr } from '../../../i18n/fr'
import page from '../pages/page.module.css'
import { ExerciseRow } from './ExerciseRow'
import styles from './ExerciseSearchList.module.css'

interface ExerciseSearchListProps {
  exercises: ExerciseDto[]
  /** Rows link to the Fiche exercice, or not (picking for a workout). */
  linkRows: boolean
  /** Shown at the end of each row (picking: "+" or the workout name). */
  action?: (exercise: ExerciseDto) => ReactNode
}

/** Search (accents/case ignored) + the exercise list: thumbnail, name, muscles · equipment. */
export function ExerciseSearchList({ exercises, linkRows, action }: ExerciseSearchListProps) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => exercises.filter((e) => matchesSearch(searchKey(e.name), query)), [exercises, query])

  return (
    <>
      <label className={styles.search}>
        <Search size={18} />
        <input
          type="search"
          placeholder={fr.muscu.searchExercise}
          aria-label={fr.muscu.searchExercise}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <ul className={page.list}>
        {visible.map((exercise) => (
          <ExerciseRow key={exercise.id} exercise={exercise} link={linkRows} action={action?.(exercise)} />
        ))}
        {visible.length === 0 && <li className={page.empty}>{fr.muscu.noExercise}</li>}
      </ul>
    </>
  )
}
