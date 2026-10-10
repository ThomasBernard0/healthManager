import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  sessionsGetExercise,
  sessionsSaveSet,
  sessionsUpdateExercise,
} from '../../../api/generated/endpoints/sessions/sessions'
import type { Feeling, SessionExerciseDto, SessionSetDto } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import { parseNumber } from '../../../core/format'
import { Check, ChevronLeft } from '../../../core/ui/icons'
import { useToast } from '../../../core/ui/toastContext'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { ExerciseThumb } from '../components/ExerciseThumb'
import { FatigueTag } from '../components/Fatigue'
import { MuscuLayout } from '../components/MuscuLayout'
import { formatSessionDate, formatSets, formatWeight } from '../format'
import { exercisePath, MUSCU_PATH, sessionPath } from '../routes'
import page from './page.module.css'
import styles from './SessionExercisePage.module.css'

const FEELINGS: Feeling[] = ['easy', 'ok', 'hard']

/** Exercice en cours: target vs done for each set, last time, Ressenti, Terminé. */
export default function SessionExercisePage() {
  const { sessionId = '', entryId = '' } = useParams()
  const loaded = useAsync(() => sessionsGetExercise(sessionId, entryId), `${sessionId}/${entryId}`)
  // Each save returns the updated exercise.
  const [latest, setLatest] = useState<SessionExerciseDto | null>(null)
  const fresh = loaded.data?.id === entryId ? loaded.data : undefined
  const data = latest?.id === entryId ? latest : fresh

  if (loaded.status === 'error' && !data) {
    // Finished or discarded meanwhile (another device): nothing to log here any more.
    return <Navigate to={MUSCU_PATH} replace />
  }
  return <MuscuLayout>{data && <Logger entry={data} onSaved={setLatest} />}</MuscuLayout>
}

function Logger({ entry, onSaved }: { entry: SessionExerciseDto; onSaved: (e: SessionExerciseDto) => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  // The first set not done yet is the one to do now.
  const current = entry.sets.find((s) => !s.done)?.index

  const toList = () => (location.key !== 'default' ? navigate(-1) : navigate(sessionPath(entry.sessionId)))

  async function run(action: () => Promise<SessionExerciseDto>): Promise<boolean> {
    setBusy(true)
    try {
      onSaved(await action())
      invalidateData()
      return true
    } catch {
      toast({ message: fr.common.saveError })
      return false
    } finally {
      setBusy(false)
    }
  }

  const saveSet = (index: number, weight: number | null, reps: number | null, done: boolean) =>
    run(() => sessionsSaveSet(entry.sessionId, entry.id, index, { weight, reps, done }))

  const setFeeling = (feeling: Feeling) =>
    run(() =>
      sessionsUpdateExercise(entry.sessionId, entry.id, { feeling: entry.feeling === feeling ? null : feeling }),
    )

  async function complete() {
    if (entry.sets.some((s) => s.done) && !entry.completed) {
      if (!(await run(() => sessionsUpdateExercise(entry.sessionId, entry.id, { completed: true })))) return
    }
    toList()
  }

  return (
    <>
      <header className={styles.header}>
        <button type="button" className={page.iconButton} aria-label={fr.muscu.session.backToList} onClick={toList}>
          <ChevronLeft />
        </button>
        <span className={styles.workout}>{entry.workoutName}</span>
      </header>

      <Link to={exercisePath(entry.exercise.id)} className={styles.identity}>
        <ExerciseThumb imageUrl={entry.exercise.imageUrl} size="lg" />
        <span className={styles.identityText}>
          <h1 className={styles.name}>{entry.exercise.name}</h1>
          <span className={styles.scheme}>{fr.muscu.setsReps(entry.sets.length, entry.repMin, entry.repMax)}</span>
          {entry.fatiguedMuscles.length > 0 && <FatigueTag muscles={entry.fatiguedMuscles} />}
        </span>
      </Link>

      <div className={styles.sets}>
        <div className={`${styles.grid} ${styles.head}`} aria-hidden="true">
          <span />
          <span>{fr.muscu.session.target}</span>
          <span>{fr.muscu.session.kg}</span>
          <span>{fr.muscu.session.reps}</span>
          <span />
        </div>
        {entry.sets.map((set) => (
          <SetRow
            // Fresh inputs whenever the row is validated or reopened.
            key={`${set.index}-${set.done}`}
            set={set}
            current={set.index === current}
            busy={busy}
            onSave={(weight, reps, done) => saveSet(set.index, weight, reps, done)}
          />
        ))}
      </div>

      {entry.lastTime && (
        <div className={styles.lastTime}>
          <span>{fr.muscu.session.lastTime(formatSessionDate(entry.lastTime.date))}</span>
          <span className={styles.lastSets}>
            {formatSets(entry.lastTime.sets).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </div>
      )}

      <div className={styles.feeling} role="group" aria-labelledby="feeling-label">
        <div id="feeling-label" className={styles.feelingLabel}>
          {fr.muscu.session.feeling}
        </div>
        <div className={styles.feelings}>
          {FEELINGS.map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.feelingButton} ${entry.feeling === f ? styles.selected : ''}`}
              aria-pressed={entry.feeling === f}
              disabled={busy}
              onClick={() => setFeeling(f)}
            >
              {fr.muscu.session.feelings[f]}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className={styles.complete} disabled={busy} onClick={complete}>
        {fr.muscu.session.completed}
      </button>
    </>
  )
}

interface SetRowProps {
  set: SessionSetDto
  /** The set to do now (highlighted). */
  current: boolean
  busy: boolean
  onSave: (weight: number | null, reps: number | null, done: boolean) => Promise<boolean>
}

/** Objectif | kg | Reps | ✓ — inputs empty with the target as placeholder; ✓ on empty inputs records the target. */
function SetRow({ set, current, busy, onSave }: SetRowProps) {
  const n = set.index + 1
  const [weight, setWeight] = useState(set.weight === null ? '' : formatWeight(set.weight))
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps))
  const hasTarget = set.targetWeight !== null && set.targetReps !== null
  const target = hasTarget ? `${formatWeight(set.targetWeight!)} × ${set.targetReps}` : fr.common.noValue

  const typedWeight = parseNumber(weight)
  const typedReps = parseNumber(reps)
  const value = {
    weight: typedWeight ?? set.targetWeight,
    reps: typedReps === null ? set.targetReps : Math.round(typedReps),
  }
  // Weights go in 0.5 kg steps (plates, stacks).
  const canValidate =
    value.weight !== null && value.reps !== null && Number.isInteger(value.weight * 2) && value.weight >= 0 && !busy

  if (set.done) {
    const under = set.targetReps !== null && set.reps! < set.targetReps
    return (
      <div className={`${styles.grid} ${styles.row}`}>
        <span className={styles.index}>{n}</span>
        <span className={styles.target}>{target}</span>
        <span className={styles.doneValue}>{formatWeight(set.weight!)}</span>
        <span className={`${styles.doneValue} ${set.targetReps === null ? '' : under ? styles.under : styles.met}`}>
          {set.reps}
        </span>
        <button
          type="button"
          className={styles.checkDone}
          aria-label={fr.muscu.session.reopen(n)}
          disabled={busy}
          onClick={() => onSave(set.weight, set.reps, false)}
        >
          <Check />
        </button>
      </div>
    )
  }

  return (
    <div className={`${styles.grid} ${styles.row} ${current ? styles.currentRow : styles.laterRow}`}>
      <span className={styles.index}>{n}</span>
      <span className={styles.target}>{target}</span>
      <input
        className={styles.input}
        inputMode="decimal"
        aria-label={fr.muscu.session.weightOf(n)}
        placeholder={set.targetWeight === null ? undefined : formatWeight(set.targetWeight)}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      <input
        className={styles.input}
        inputMode="numeric"
        aria-label={fr.muscu.session.repsOf(n)}
        placeholder={set.targetReps === null ? undefined : String(set.targetReps)}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
      />
      <button
        type="button"
        className={styles.check}
        aria-label={fr.muscu.session.validate(n)}
        disabled={!canValidate}
        onClick={() => onSave(typedWeight, typedReps === null ? null : Math.round(typedReps), true)}
      >
        <Check />
      </button>
    </div>
  )
}
