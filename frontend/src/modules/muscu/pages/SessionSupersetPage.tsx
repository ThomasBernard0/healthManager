import { interleaveSets } from '@healthmanager/shared'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  sessionsGetExercise,
  sessionsSaveSet,
  sessionsUpdateExercise,
} from '../../../api/generated/endpoints/sessions/sessions'
import type { Feeling, SessionExerciseDto } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { ChevronLeft } from '../../../core/ui/icons'
import { useToast } from '../../../core/ui/toastContext'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { ExerciseImage } from '../components/ExerciseImage'
import { FeelingButtons } from '../components/FeelingButtons'
import { MuscuLayout } from '../components/MuscuLayout'
import { SetRow, SetTable } from '../components/SetTable'
import { SupersetBadge } from '../components/SupersetBadge'
import { formatSessionDate, formatSets } from '../format'
import { exercisePath, MUSCU_PATH, sessionExercisePath, sessionPath } from '../routes'
import page from './page.module.css'
import common from './SessionExercisePage.module.css'
import styles from './SessionSupersetPage.module.css'

/** The two exercises of the superset: a (first in the workout) and b. */
interface Pair {
  a: SessionExerciseDto
  b: SessionExerciseDto | null
}

const LETTERS = { a: 'A', b: 'B' } as const

/** Superset en cours: the sets of two exercises done alternately (A1, B1, A2…), opened by the first one. */
export default function SessionSupersetPage() {
  const { sessionId = '', entryId = '' } = useParams()
  const loaded = useAsync(async (): Promise<Pair> => {
    const a = await sessionsGetExercise(sessionId, entryId)
    return { a, b: a.partnerId ? await sessionsGetExercise(sessionId, a.partnerId) : null }
  }, `${sessionId}/${entryId}`)
  // Each save returns the updated exercise.
  const [latest, setLatest] = useState<Pair | null>(null)
  const fresh = loaded.data?.a.id === entryId ? loaded.data : undefined
  const data = latest?.a.id === entryId ? latest : fresh

  if (loaded.status === 'error' && !data) {
    // Finished or discarded meanwhile (another device): nothing to log here any more.
    return <Navigate to={MUSCU_PATH} replace />
  }
  // Not in a superset (any more): the usual screen.
  if (data && !data.b) return <Navigate to={sessionExercisePath(sessionId, entryId)} replace />
  return <MuscuLayout>{data?.b && <Logger a={data.a} b={data.b} onSaved={setLatest} />}</MuscuLayout>
}

interface LoggerProps {
  a: SessionExerciseDto
  b: SessionExerciseDto
  onSaved: (pair: Pair) => void
}

function Logger({ a, b, onSaved }: LoggerProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [stopping, setStopping] = useState(false)
  const entries = { a, b }
  const rows = interleaveSets(a.sets, b.sets)
  // The first set not done yet, in superset order, is the one to do now.
  const current = rows.find((r) => !r.set.done)
  const doneCount = rows.filter((r) => r.set.done).length
  const allDone = doneCount === rows.length

  const toList = () => (location.key !== 'default' ? navigate(-1) : navigate(sessionPath(a.sessionId)))

  /** Saves one exercise; the other one is read again while its targets are still live (nothing validated yet). */
  async function run(which: 'a' | 'b', action: (entry: SessionExerciseDto) => Promise<SessionExerciseDto>): Promise<boolean> {
    setBusy(true)
    try {
      const saved = await action(entries[which])
      const other = which === 'a' ? b : a
      const refreshed = other.sets.some((s) => s.done) ? other : await sessionsGetExercise(other.sessionId, other.id)
      onSaved(which === 'a' ? { a: saved, b: refreshed } : { a: refreshed, b: saved })
      invalidateData()
      return true
    } catch {
      toast({ message: fr.common.saveError })
      return false
    } finally {
      setBusy(false)
    }
  }

  const saveSet = (which: 'a' | 'b', index: number, weight: number | null, reps: number | null, done: boolean) =>
    run(which, (entry) => sessionsSaveSet(entry.sessionId, entry.id, index, { weight, reps, done }))

  const setFeeling = (which: 'a' | 'b', feeling: Feeling | null) =>
    run(which, (entry) => sessionsUpdateExercise(entry.sessionId, entry.id, { feeling }))

  /** Terminé (every set done) or, after confirmation, earlier: each exercise with a validated set is completed. */
  async function complete() {
    setBusy(true)
    try {
      const [doneA, doneB] = await Promise.all(
        [a, b].map((entry) =>
          entry.completed || !entry.sets.some((s) => s.done)
            ? entry
            : sessionsUpdateExercise(entry.sessionId, entry.id, { completed: true }),
        ),
      )
      onSaved({ a: doneA, b: doneB })
      invalidateData()
    } catch {
      toast({ message: fr.common.saveError })
      return
    } finally {
      setBusy(false)
    }
    toList()
  }

  return (
    <>
      <header className={common.header}>
        <button type="button" className={page.iconButton} aria-label={fr.muscu.session.backToList} onClick={toList}>
          <ChevronLeft />
        </button>
        <h1 className={styles.title}>{fr.muscu.superset.header(a.workoutName)}</h1>
      </header>

      <div className={styles.pair}>
        {(['a', 'b'] as const).map((which) => {
          const entry = entries[which]
          return (
            <Link key={entry.id} to={exercisePath(entry.exercise.id)} className={styles.exercise}>
              <span className={styles.imageBox}>
                <ExerciseImage exercise={entry.exercise} className={styles.image} />
                <span className={styles.imageBadge}>
                  <SupersetBadge letter={LETTERS[which]} />
                </span>
              </span>
              <span className={styles.exerciseText}>
                <span className={styles.exerciseName}>{entry.exercise.name}</span>
                <span className={styles.scheme}>{fr.muscu.setsReps(entry.sets.length, entry.repMin, entry.repMax)}</span>
              </span>
            </Link>
          )
        })}
      </div>

      <SetTable wide>
        {rows.map(({ exercise, index, set }) => {
          const label = fr.muscu.superset.set(LETTERS[exercise], index + 1)
          return (
            <SetRow
              // Fresh inputs whenever the row is validated or reopened.
              key={`${exercise}${index}-${set.done}`}
              set={set}
              index={
                <>
                  <SupersetBadge letter={LETTERS[exercise]} size="sm" />
                  {index + 1}
                </>
              }
              labels={{
                weight: fr.muscu.superset.weightOf(label),
                reps: fr.muscu.superset.repsOf(label),
                validate: fr.muscu.superset.validate(label),
                reopen: fr.muscu.superset.reopen(label),
              }}
              current={current?.exercise === exercise && current.index === index}
              busy={busy}
              onSave={(weight, reps, done) => saveSet(exercise, index, weight, reps, done)}
            />
          )
        })}
      </SetTable>

      {(a.lastTime || b.lastTime) && (
        <div className={styles.lastTimes}>
          {(['a', 'b'] as const).map((which) => {
            const { lastTime } = entries[which]
            return (
              lastTime && (
                <div key={which} className={common.lastTime}>
                  <span className={styles.badged}>
                    <SupersetBadge letter={LETTERS[which]} size="sm" />
                    {fr.muscu.session.lastTime(formatSessionDate(lastTime.date))}
                  </span>
                  <span className={common.lastSets}>
                    {formatSets(lastTime.sets).map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </span>
                </div>
              )
            )
          })}
        </div>
      )}

      <div className={common.feeling}>
        <div className={common.feelingLabel}>{fr.muscu.session.feeling}</div>
        {(['a', 'b'] as const).map((which) => (
          <div key={which} className={styles.feelings} role="group" aria-label={entries[which].exercise.name}>
            <SupersetBadge letter={LETTERS[which]} />
            <FeelingButtons
              value={entries[which].feeling}
              disabled={busy}
              onChange={(feeling) => setFeeling(which, feeling)}
            />
          </div>
        ))}
      </div>

      <button type="button" className={common.complete} disabled={busy || !allDone} onClick={complete}>
        {fr.muscu.session.completed}
      </button>
      {/* Not the usual flow: a small link, and a confirmation. */}
      {doneCount > 0 && !allDone && (
        <button type="button" className={common.stopEarly} disabled={busy} onClick={() => setStopping(true)}>
          {fr.muscu.superset.stopEarly}
        </button>
      )}

      {stopping && (
        <ConfirmSheet
          title={fr.muscu.session.confirmStopEarly(doneCount, rows.length)}
          confirmLabel={fr.muscu.session.stopEarlyAction}
          busy={busy}
          onConfirm={complete}
          onCancel={() => setStopping(false)}
        />
      )}
    </>
  )
}
