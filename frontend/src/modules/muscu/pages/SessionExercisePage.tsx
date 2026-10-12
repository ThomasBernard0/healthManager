import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  sessionsGetExercise,
  sessionsSaveSet,
  sessionsUpdateExercise,
} from '../../../api/generated/endpoints/sessions/sessions'
import type { SessionExerciseDto } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import { ChevronLeft } from '../../../core/ui/icons'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { useToast } from '../../../core/ui/toastContext'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { EasyToggle } from '../components/EasyToggle'
import { ExerciseThumb } from '../components/ExerciseThumb'
import { LoadToggle } from '../components/LoadToggle'
import { MuscuLayout } from '../components/MuscuLayout'
import { SetRow, SetTable } from '../components/SetTable'
import { formatSessionDate, formatSets } from '../format'
import { setInMode, setsToFlip, signedWeight, useLoadMode, type LoadMode } from '../loadMode'
import { exercisePath, MUSCU_PATH, sessionPath } from '../routes'
import page from './page.module.css'
import styles from './SessionExercisePage.module.css'

/** Exercice en cours: target vs done for each set, last time, Facile, Terminé. */
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
  const [stopping, setStopping] = useState(false)
  // Bodyweight exercises: the weights typed are added load (Lest) or help (Aide, stored negative).
  const [mode, chooseMode] = useLoadMode(entry)
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
    run(() =>
      sessionsSaveSet(entry.sessionId, entry.id, index, {
        weight: weight === null || mode === null ? weight : signedWeight(weight, mode),
        reps,
        done,
      }),
    )

  /** Lest ↔ Aide: the sets already logged are saved again with the other sign. */
  async function switchMode(next: LoadMode) {
    chooseMode(next)
    const logged = setsToFlip(entry.sets, next)
    if (logged.length === 0) return
    const saved = await run(async () => {
      let latest = entry
      for (const { index, weight, reps } of logged) {
        latest = await sessionsSaveSet(entry.sessionId, entry.id, index, { weight, reps, done: true })
      }
      return latest
    })
    if (!saved) chooseMode(null)
  }

  const setEasy = (easy: boolean) => run(() => sessionsUpdateExercise(entry.sessionId, entry.id, { easy }))

  const doneCount = entry.sets.filter((s) => s.done).length
  const allDone = doneCount === entry.sets.length

  /** Terminé (every set done) or, after confirmation, Terminer l'exercice plus tôt. */
  async function complete() {
    if (!entry.completed) {
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
        <ExerciseThumb exercise={entry.exercise} size="lg" />
        <span className={styles.identityText}>
          <h1 className={styles.name}>{entry.exercise.name}</h1>
          <span className={styles.scheme}>{fr.muscu.setsReps(entry.sets.length, entry.repMin, entry.repMax)}</span>
        </span>
      </Link>

      <SetTable
        assist={mode === 'assist'}
        top={
          mode && <LoadToggle mode={mode} disabled={busy} label={fr.muscu.session.loadType} onChange={switchMode} />
        }
      >
        {entry.sets.map((set) => {
          const n = set.index + 1
          return (
            <SetRow
              // Fresh inputs whenever the row is validated or reopened.
              key={`${set.index}-${set.done}`}
              set={mode ? setInMode(set, mode) : set}
              index={n}
              labels={{
                weight: mode === 'assist' ? fr.muscu.session.assistOf(n) : fr.muscu.session.weightOf(n),
                reps: fr.muscu.session.repsOf(n),
                validate: fr.muscu.session.validate(n),
                reopen: fr.muscu.session.reopen(n),
              }}
              current={set.index === current}
              busy={busy}
              onSave={(weight, reps, done) => saveSet(set.index, weight, reps, done)}
            />
          )
        })}
      </SetTable>

      {entry.lastTime && (
        <div className={styles.lastTime}>
          <span>{fr.muscu.session.lastTime(formatSessionDate(entry.lastTime.date))}</span>
          <span className={styles.lastSets}>
            {formatSets(entry.lastTime.sets, mode !== null).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </div>
      )}

      <div className={styles.easy}>
        <EasyToggle pressed={entry.easy} disabled={busy} label={fr.muscu.session.easyLabel} onChange={setEasy} />
      </div>

      <button type="button" className={styles.complete} disabled={busy || !allDone} onClick={complete}>
        {fr.muscu.session.completed}
      </button>
      {/* Not the usual flow: a small link, and a confirmation. */}
      {doneCount > 0 && !allDone && (
        <button type="button" className={styles.stopEarly} disabled={busy} onClick={() => setStopping(true)}>
          {fr.muscu.session.stopEarly}
        </button>
      )}

      {stopping && (
        <ConfirmSheet
          title={fr.muscu.session.confirmStopEarly(doneCount, entry.sets.length)}
          confirmLabel={fr.muscu.session.stopEarlyAction}
          busy={busy}
          onConfirm={complete}
          onCancel={() => setStopping(false)}
        />
      )}
    </>
  )
}
