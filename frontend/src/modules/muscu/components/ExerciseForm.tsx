import { EQUIPMENTS, MUSCLES } from '@healthmanager/shared'
import { useState, type FormEvent, type ReactNode } from 'react'
import { exercisesCreate, exercisesUpdate } from '../../../api/generated/endpoints/exercises/exercises'
import type { Equipment, ExerciseDto, Muscle } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import styles from './ExerciseForm.module.css'

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

interface ExerciseFormProps {
  /** null: a new exercise. */
  exercise: ExerciseDto | null
  /** Above the fields (the page's back · title header). */
  header?: ReactNode
  onSaved: (exercise: ExerciseDto) => void
}

/** Créer / Modifier l'exercice: name, equipment, muscles (none → secondary → primary), Enregistrer. */
export function ExerciseForm({ exercise, header, onSaved }: ExerciseFormProps) {
  const [draft, setDraft] = useState<Draft>(() =>
    exercise ? toDraft(exercise) : { name: '', equipment: null, roles: {} },
  )
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle')

  const primary = MUSCLES.filter((m) => draft.roles[m] === 'primary')
  const secondary = MUSCLES.filter((m) => draft.roles[m] === 'secondary')
  const valid = draft.name.trim() !== '' && draft.equipment !== null && primary.length > 0

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid || !draft.equipment) return
    setStatus('busy')
    const body = { name: draft.name.trim(), equipment: draft.equipment, primaryMuscles: primary, secondaryMuscles: secondary }
    try {
      const saved = exercise ? await exercisesUpdate(exercise.id, body) : await exercisesCreate(body)
      invalidateData()
      onSaved(saved)
    } catch {
      setStatus('error')
    }
  }

  return (
    <form className={styles.form} onSubmit={save}>
      {header}

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
  )
}
