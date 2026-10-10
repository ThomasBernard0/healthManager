import { matchesSearch, searchKey } from '@healthmanager/shared'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { exercisesList } from '../../../api/generated/endpoints/exercises/exercises'
import { useDataVersion } from '../../../core/dataVersion'
import { ChevronLeft, Plus, Search } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { ExerciseThumb } from '../components/ExerciseThumb'
import { MuscuLayout } from '../components/MuscuLayout'
import { exerciseSubtitle } from '../format'
import { exercisePath, MUSCU_PATH, NEW_EXERCISE_PATH } from '../routes'
import page from './page.module.css'
import styles from './ExercisesPage.module.css'

/** Where the exercise drawings come from (their licence asks for credit). */
const DRAWINGS_SOURCE = 'https://github.com/everkinetic/data'

/** Exercices: the bank, searchable (accents/case ignored). */
export default function ExercisesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const version = useDataVersion()
  const exercises = useAsync(() => exercisesList(), `exercises#${version}`)
  const [query, setQuery] = useState('')

  const visible = useMemo(
    () => (exercises.data ?? []).filter((e) => matchesSearch(searchKey(e.name), query)),
    [exercises.data, query],
  )

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(MUSCU_PATH))

  return (
    <MuscuLayout>
      <header className={page.header}>
        <button type="button" className={page.iconButton} aria-label={fr.common.back} onClick={back}>
          <ChevronLeft />
        </button>
        <h1 className={page.title}>{fr.muscu.exercises}</h1>
        <Link to={NEW_EXERCISE_PATH} className={page.accentButton} aria-label={fr.muscu.createExercise}>
          <Plus size={22} />
        </Link>
      </header>

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

      {exercises.status === 'error' && !exercises.data && (
        <div className={page.alert} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={exercises.reload}>
            {fr.common.retry}
          </button>
        </div>
      )}

      {exercises.data && (
        <ul className={page.list}>
          {visible.map((exercise) => (
            <li key={exercise.id}>
              <Link to={exercisePath(exercise.id)} className={styles.row}>
                <ExerciseThumb imageUrl={exercise.imageUrl} />
                <span className={styles.text}>
                  <span className={styles.name}>{exercise.name}</span>
                  <span className={styles.meta}>{exerciseSubtitle(exercise)}</span>
                </span>
              </Link>
            </li>
          ))}
          {visible.length === 0 && <li className={page.empty}>{fr.muscu.noExercise}</li>}
        </ul>
      )}

      <a className={styles.credit} href={DRAWINGS_SOURCE} target="_blank" rel="noreferrer">
        {fr.muscu.drawingsCredit}
      </a>
    </MuscuLayout>
  )
}
