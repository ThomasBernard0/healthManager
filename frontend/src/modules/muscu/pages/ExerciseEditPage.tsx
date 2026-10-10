import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { exercisesGet } from '../../../api/generated/endpoints/exercises/exercises'
import type { ExerciseDto } from '../../../api/generated/model'
import { ChevronLeft } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { ExerciseForm } from '../components/ExerciseForm'
import { MuscuLayout } from '../components/MuscuLayout'
import { EXERCISES_PATH, exercisePath } from '../routes'
import page from './page.module.css'

/** Créer / Modifier l'exercice (page). */
export default function ExerciseEditPage() {
  const { id } = useParams()
  const existing = useAsync(() => (id ? exercisesGet(id) : Promise.resolve(null)), id ?? 'new')
  const loaded = existing.data !== undefined && (existing.data === null || existing.data.id === id)

  if (existing.status === 'error' && !loaded) {
    return (
      <MuscuLayout>
        <div className={page.alert} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={existing.reload}>
            {fr.common.retry}
          </button>
        </div>
      </MuscuLayout>
    )
  }
  if (!loaded) return <MuscuLayout>{null}</MuscuLayout>
  return <Editor key={id ?? 'new'} exercise={existing.data ?? null} />
}

function Editor({ exercise }: { exercise: ExerciseDto | null }) {
  const navigate = useNavigate()
  const location = useLocation()

  const back = () =>
    location.key !== 'default' ? navigate(-1) : navigate(exercise ? exercisePath(exercise.id) : EXERCISES_PATH)

  return (
    <MuscuLayout>
      <ExerciseForm
        exercise={exercise}
        header={
          <header className={page.header}>
            <button type="button" className={page.iconButton} aria-label={fr.common.back} onClick={back}>
              <ChevronLeft />
            </button>
            <h1 className={page.title}>{exercise ? fr.muscu.exercise : fr.muscu.createExercise}</h1>
            <span className={page.spacer} />
          </header>
        }
        // Back to the fiche; a new exercise replaces this form in the history.
        onSaved={(saved) =>
          exercise && location.key !== 'default' ? navigate(-1) : navigate(exercisePath(saved.id), { replace: true })
        }
      />
    </MuscuLayout>
  )
}
