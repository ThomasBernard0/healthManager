import { EQUIPMENTS, MUSCLES } from '@healthmanager/shared'
import { Fragment, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  exercisesCreate,
  exercisesRemoveImage,
  exercisesSetImage,
  exercisesUpdate,
} from '../../../api/generated/endpoints/exercises/exercises'
import type { Equipment, ExerciseDto, Muscle } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import { resizeImage } from '../resizeImage'
import { useExerciseImage } from '../useExerciseImage'
import { ImageFrame } from './ExerciseImage'
import styles from './ExerciseForm.module.css'

type Role = 'none' | 'secondary' | 'primary'

/** Same bounds as the API (SaveExerciseDto). */
const MAX_SETS = 10
const MAX_REPS = 100

/** A typed whole number, or null. */
const toInt = (text: string): number | null => (/^\d+$/.test(text) ? Number(text) : null)

/** Tap cycle of a muscle pill. */
const NEXT_ROLE: Record<Role, Role> = { none: 'secondary', secondary: 'primary', primary: 'none' }

interface Draft {
  name: string
  equipment: Equipment | null
  roles: Partial<Record<Muscle, Role>>
  /** As typed. */
  sets: string
  repMin: string
  repMax: string
}

/** The picture as it will be saved: the stored one, a newly picked one, or none. */
type Picture = { kind: 'keep' } | { kind: 'new'; blob: Blob; url: string } | { kind: 'remove' }

const toDraft = (e: ExerciseDto): Draft => ({
  name: e.name,
  equipment: e.equipment,
  roles: Object.fromEntries([
    ...e.primaryMuscles.map((m) => [m, 'primary']),
    ...e.secondaryMuscles.map((m) => [m, 'secondary']),
  ]),
  sets: String(e.sets),
  repMin: String(e.repMin),
  repMax: String(e.repMax),
})

/** A new exercise: 4 × 8–12. */
const NEW_DRAFT: Draft = { name: '', equipment: null, roles: {}, sets: '4', repMin: '7', repMax: '10' }

interface ExerciseFormProps {
  /** null: a new exercise. */
  exercise: ExerciseDto | null
  /** Above the fields (the page's back · title header). */
  header?: ReactNode
  onSaved: (exercise: ExerciseDto) => void
}

/**
 * Créer / Modifier l'exercice: name, sets × rep range, image, equipment, muscles (none → secondary → primary),
 * Enregistrer.
 */
export function ExerciseForm({ exercise, header, onSaved }: ExerciseFormProps) {
  const [draft, setDraft] = useState<Draft>(() => (exercise ? toDraft(exercise) : NEW_DRAFT))
  const [picture, setPicture] = useState<Picture>({ kind: 'keep' })
  const [imageError, setImageError] = useState(false)
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle')

  const storedVersion = picture.kind === 'keep' ? (exercise?.imageVersion ?? null) : null
  const stored = useExerciseImage(exercise?.id ?? '', storedVersion)
  const shown = picture.kind === 'new' ? { url: picture.url, isDrawing: false } : stored
  const hasImage = picture.kind === 'new' || storedVersion !== null

  const primary = MUSCLES.filter((m) => draft.roles[m] === 'primary')
  const secondary = MUSCLES.filter((m) => draft.roles[m] === 'secondary')
  const sets = toInt(draft.sets)
  const repMin = toInt(draft.repMin)
  const repMax = toInt(draft.repMax)
  const scheme =
    sets !== null && repMin !== null && repMax !== null && sets >= 1 && sets <= MAX_SETS && repMin >= 1 && repMin <= repMax && repMax <= MAX_REPS
      ? { sets, repMin, repMax }
      : null
  const valid = draft.name.trim() !== '' && draft.equipment !== null && primary.length > 0 && scheme !== null

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const blob = await resizeImage(file)
      setPicture({ kind: 'new', blob, url: URL.createObjectURL(blob) })
      setImageError(false)
    } catch {
      setImageError(true)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid || !draft.equipment || !scheme) return
    setStatus('busy')
    const body = {
      name: draft.name.trim(),
      equipment: draft.equipment,
      primaryMuscles: primary,
      secondaryMuscles: secondary,
      ...scheme,
    }
    try {
      let saved = exercise ? await exercisesUpdate(exercise.id, body) : await exercisesCreate(body)
      if (picture.kind === 'new') saved = await exercisesSetImage(saved.id, { file: picture.blob })
      else if (picture.kind === 'remove' && saved.imageVersion !== null) saved = await exercisesRemoveImage(saved.id)
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
        <legend className={styles.legend}>{fr.muscu.schemeLabel}</legend>
        <div className={styles.scheme}>
          {(
            [
              ['sets', fr.muscu.sets, fr.muscu.setsInput, '×'],
              ['repMin', fr.muscu.repMin, fr.muscu.repMinInput, '–'],
              ['repMax', fr.muscu.repMax, fr.muscu.repMaxInput, null],
            ] as const
          ).map(([key, label, ariaLabel, separator]) => (
            <Fragment key={key}>
              <label className={styles.schemeField}>
                {label}
                <input
                  className={`${form.input} ${styles.schemeInput}`}
                  inputMode="numeric"
                  aria-label={ariaLabel}
                  value={draft[key]}
                  maxLength={3}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value.replace(/\D/g, '') }))}
                />
              </label>
              {separator && (
                <span className={styles.schemeSeparator} aria-hidden="true">
                  {separator}
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{fr.muscu.imageLabel}</legend>
        <div className={styles.picture}>
          <ImageFrame image={shown} className={styles.tile} />
          <div className={styles.pills}>
            <label className={`${styles.pill} ${styles.filePill}`}>
              {hasImage ? fr.muscu.replaceImage : fr.muscu.chooseImage}
              <input type="file" accept="image/*" className={styles.file} onChange={pick} />
            </label>
            {hasImage && (
              <button type="button" className={styles.pill} onClick={() => setPicture({ kind: 'remove' })}>
                {fr.muscu.removeImage}
              </button>
            )}
          </div>
        </div>
        {imageError && (
          <div className={form.error} role="alert">
            {fr.muscu.imageError}
          </div>
        )}
      </fieldset>

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
