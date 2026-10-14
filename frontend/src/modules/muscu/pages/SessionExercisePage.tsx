import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from '../../../core/ui/icons'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { useToast } from '../../../core/ui/toastContext'
import { fr } from '../../../i18n/fr'
import { EasyToggle } from '../components/EasyToggle'
import { ExerciseThumb } from '../components/ExerciseThumb'
import { LoadToggle } from '../components/LoadToggle'
import { MuscuLayout } from '../components/MuscuLayout'
import { SetRow, SetTable } from '../components/SetTable'
import { formatSessionDate, formatSets } from '../format'
import { setInMode, setsToFlip, signedWeight, useLoadMode, type LoadMode } from '../loadMode'
import {
  exerciseView,
  saveSet as saveLocalSet,
  updateExercise,
  type ExerciseView,
  type LocalSession,
} from '../offline/localSession'
import { SessionImages } from '../offline/SessionImages'
import { updateLocalSession, useLocalSession } from '../offline/store'
import { sessionPath } from '../routes'
import page from './page.module.css'
import styles from './SessionExercisePage.module.css'

/** Exercice en cours: target vs done for each set, last time, Facile, Terminé — on the local copy only. */
export default function SessionExercisePage() {
  const { sessionId = '', entryId = '' } = useParams()
  const local = useLocalSession()
  const entry = local?.id === sessionId ? exerciseView(local, entryId) : null

  if (local === undefined) return <MuscuLayout>{null}</MuscuLayout>
  // Not on this device (or not in the session): the list loads it, or goes back to Accueil.
  if (!entry) return <Navigate to={sessionPath(sessionId)} replace />
  return (
    <MuscuLayout>
      <SessionImages>
        <Logger entry={entry} />
      </SessionImages>
    </MuscuLayout>
  )
}

function Logger({ entry }: { entry: ExerciseView }) {
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

  /** Every change is written to the device (no network). */
  async function run(change: (session: LocalSession) => LocalSession): Promise<boolean> {
    setBusy(true)
    try {
      await updateLocalSession(change)
      return true
    } catch {
      toast({ message: fr.common.saveError })
      return false
    } finally {
      setBusy(false)
    }
  }

  const saveSet = (index: number, weight: number | null, reps: number | null, done: boolean) =>
    run((session) =>
      saveLocalSet(
        session,
        entry.id,
        index,
        { weight: weight === null || mode === null ? weight : signedWeight(weight, mode), reps, done },
      ),
    )

  /** Lest ↔ Aide: the sets already logged are saved again with the other sign. */
  async function switchMode(next: LoadMode) {
    chooseMode(next)
    const logged = setsToFlip(entry.sets, next)
    if (logged.length === 0) return
    const saved = await run((session) =>
      logged.reduce((s, { index, weight, reps }) => saveLocalSet(s, entry.id, index, { weight, reps, done: true }), session),
    )
    if (!saved) chooseMode(null)
  }

  const setEasy = (easy: boolean) => run((session) => updateExercise(session, entry.id, { easy }))

  const doneCount = entry.sets.filter((s) => s.done).length
  const allDone = doneCount === entry.sets.length

  /** Terminé (every set done) or, after confirmation, Terminer l'exercice plus tôt. */
  async function complete() {
    if (!entry.completed) {
      if (!(await run((session) => updateExercise(session, entry.id, { completed: true })))) return
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

      <div className={styles.identity}>
        <ExerciseThumb exercise={entry.exercise} size="lg" />
        <span className={styles.identityText}>
          <h1 className={styles.name}>{entry.exercise.name}</h1>
          <span className={styles.scheme}>{fr.muscu.setsReps(entry.sets.length, entry.repMin, entry.repMax)}</span>
        </span>
      </div>

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
