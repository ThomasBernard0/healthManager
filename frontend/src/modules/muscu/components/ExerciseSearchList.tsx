import { matchesSearch, searchKey } from '@healthmanager/shared'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ExerciseDto } from '../../../api/generated/model'
import { Search } from '../../../core/ui/icons'
import { fr } from '../../../i18n/fr'
import { exerciseSubtitle } from '../format'
import { exercisePath } from '../routes'
import page from '../pages/page.module.css'
import { ExerciseThumb } from './ExerciseThumb'
import styles from './ExerciseSearchList.module.css'

/** Where the exercise drawings come from (their licence asks for credit). */
const DRAWINGS_SOURCE = 'https://github.com/everkinetic/data'

interface ExerciseSearchListProps {
  exercises: ExerciseDto[]
  /** Rows link to the Fiche exercice (the bank), or not (picking for a workout). */
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
        {visible.map((exercise) => {
          const content = (
            <>
              <ExerciseThumb imageUrl={exercise.imageUrl} />
              <span className={styles.text}>
                <span className={styles.name}>{exercise.name}</span>
                <span className={styles.meta}>{exerciseSubtitle(exercise)}</span>
              </span>
            </>
          )
          return (
            <li key={exercise.id} className={styles.item}>
              {linkRows ? (
                <Link to={exercisePath(exercise.id)} className={styles.row}>
                  {content}
                </Link>
              ) : (
                <span className={styles.row}>{content}</span>
              )}
              {action && <span className={styles.action}>{action(exercise)}</span>}
            </li>
          )
        })}
        {visible.length === 0 && <li className={page.empty}>{fr.muscu.noExercise}</li>}
      </ul>

      <a className={styles.credit} href={DRAWINGS_SOURCE} target="_blank" rel="noreferrer">
        {fr.muscu.drawingsCredit}
      </a>
    </>
  )
}
