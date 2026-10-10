import { Link, useLocation, useNavigate } from 'react-router-dom'
import { exercisesList } from '../../../api/generated/endpoints/exercises/exercises'
import { useDataVersion } from '../../../core/dataVersion'
import { ChevronLeft, Plus } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { ExerciseSearchList } from '../components/ExerciseSearchList'
import { MuscuLayout } from '../components/MuscuLayout'
import { MUSCU_PATH, NEW_EXERCISE_PATH } from '../routes'
import page from './page.module.css'

/** Exercices: the bank, searchable (accents/case ignored). */
export default function ExercisesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const version = useDataVersion()
  const exercises = useAsync(() => exercisesList(), `exercises#${version}`)

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

      {exercises.status === 'error' && !exercises.data && (
        <div className={page.alert} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={exercises.reload}>
            {fr.common.retry}
          </button>
        </div>
      )}

      {exercises.data && <ExerciseSearchList exercises={exercises.data} linkRows />}
    </MuscuLayout>
  )
}
