import { EQUIPMENTS, MUSCLES } from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  exercisesCreate,
  exercisesGet,
  exercisesUpdate,
} from '../../../api/generated/endpoints/exercises/exercises'
import type { Equipment, ExerciseDto, Muscle } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import { ChevronLeft } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { MuscuLayout } from '../components/MuscuLayout'
import { EXERCISES_PATH, exercisePath } from '../routes'
import page from './page.module.css'
import styles from './ExerciseEditPage.module.css'

type Role = 'none' | 'secondary' | 'primary'

/** Tap cycle of a muscle pill. */
const NEXT_ROLE: Record<Role, Role> = { none: 'secondary', secondary: 'primary', primary: 'none' }

interface Draft {
  name: string
  equipment: Equipment | null
  roles: Partial<Record<Muscle, Role>>
}

const toDraft = (e: ExerciseDto): Draft => ({
  name: e.name,
  equipment: e.equipment,
  roles: Object.fromEntries([
    ...e.primaryMuscles.map((m) => [m, 'primary']),
    ...e.secondaryMuscles.map((m) => [m, 'secondary']),
  ]),
})

/** Créer / Modifier l'exercice: name, equipment, muscles (none → secondary → primary). */
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
  const [draft, setDraft] = useState<Draft>(() =>
    exercise ? toDraft(exercise) : { name: '', equipment: null, roles: {} },
  )
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle')

  const primary = MUSCLES.filter((m) => draft.roles[m] === 'primary')
  const secondary = MUSCLES.filter((m) => draft.roles[m] === 'secondary')
  const valid = draft.name.trim() !== '' && draft.equipment !== null && primary.length > 0

  const back = () =>
    location.key !== 'default' ? navigate(-1) : navigate(exercise ? exercisePath(exercise.id) : EXERCISES_PATH)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid || !draft.equipment) return
    setStatus('busy')
    const body = { name: draft.name.trim(), equipment: draft.equipment, primaryMuscles: primary, secondaryMuscles: secondary }
    try {
      const saved = exercise ? await exercisesUpdate(exercise.id, body) : await exercisesCreate(body)
      invalidateData()
      // Back to the fiche; a new exercise replaces this form in the history.
      if (exercise && location.key !== 'default') navigate(-1)
      else navigate(exercisePath(saved.id), { replace: true })
    } catch {
      setStatus('error')
    }
  }

  return (
    <MuscuLayout>
      <form className={styles.form} onSubmit={save}>
        <header className={page.header}>
          <button type="button" className={page.iconButton} aria-label={fr.common.back} onClick={back}>
            <ChevronLeft />
          </button>
          <h1 className={page.title}>{exercise ? fr.muscu.exercise : fr.muscu.createExercise}</h1>
          <span className={page.spacer} />
        </header>

        <label className={form.field}>
          {fr.muscu.name}
          <input
            className={form.input}
            value={draft.name}
            maxLength={80}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </label>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{fr.muscu.equipmentLabel}</legend>
          <div className={styles.pills}>
            {EQUIPMENTS.map((eq) => (
              <button
                key={eq}
                type="button"
                className={`${styles.pill} ${draft.equipment === eq ? styles.primary : ''}`}
                aria-pressed={draft.equipment === eq}
                onClick={() => setDraft((d) => ({ ...d, equipment: eq }))}
              >
                {fr.muscu.equipment[eq]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{fr.muscu.musclesLabel}</legend>
          <div className={styles.pills}>
            {MUSCLES.map((m) => {
              const role = draft.roles[m] ?? 'none'
              return (
                <button
                  key={m}
                  type="button"
                  className={`${styles.pill} ${role !== 'none' ? styles[role] : ''}`}
                  aria-label={`${fr.muscu.muscles[m]} : ${fr.muscu.muscleState[role]}`}
                  onClick={() => setDraft((d) => ({ ...d, roles: { ...d.roles, [m]: NEXT_ROLE[role] } }))}
                >
                  {fr.muscu.muscles[m]}
                </button>
              )
            })}
          </div>
          <div className={styles.legendRow} aria-hidden="true">
            <span className={styles.key}>
              <span className={styles.dotPrimary} />
              {fr.muscu.primary}
            </span>
            <span className={styles.key}>
              <span className={styles.dotSecondary} />
              {fr.muscu.secondary}
            </span>
          </div>
        </fieldset>

        {status === 'error' && (
          <div className={form.error} role="alert">
            {fr.common.saveError}
          </div>
        )}

        <button type="submit" className={`${form.primary} ${styles.submit}`} disabled={!valid || status === 'busy'}>
          {fr.common.save}
        </button>
      </form>
    </MuscuLayout>
  )
}
