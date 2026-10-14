import { interleaveSets } from '@healthmanager/shared'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { ChevronLeft } from '../../../core/ui/icons'
import { useToast } from '../../../core/ui/toastContext'
import { fr } from '../../../i18n/fr'
import { EasyToggle } from '../components/EasyToggle'
import { ExerciseImage } from '../components/ExerciseImage'
import { LoadToggle } from '../components/LoadToggle'
import { MuscuLayout } from '../components/MuscuLayout'
import { SetRow, SetTable } from '../components/SetTable'
import { SupersetBadge } from '../components/SupersetBadge'
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
import { sessionExercisePath, sessionPath } from '../routes'
import page from './page.module.css'
import common from './SessionExercisePage.module.css'
import styles from './SessionSupersetPage.module.css'

const LETTERS = { a: 'A', b: 'B' } as const

/** Superset en cours: the sets of two exercises done alternately (A1, B1, A2…), opened by the first one. Local copy only. */
export default function SessionSupersetPage() {
  const { sessionId = '', entryId = '' } = useParams()
  const local = useLocalSession()
  const a = local?.id === sessionId ? exerciseView(local, entryId) : null
  const b = local && a?.partnerId ? exerciseView(local, a.partnerId) : null

  if (local === undefined) return <MuscuLayout>{null}</MuscuLayout>
  // Not on this device (or not in the session): the list loads it, or goes back to Accueil.
  if (!a) return <Navigate to={sessionPath(sessionId)} replace />
  // Not in a superset: the usual screen.
  if (!b) return <Navigate to={sessionExercisePath(sessionId, entryId)} replace />
  return (
    <MuscuLayout>
      <SessionImages>
        <Logger a={a} b={b} />
      </SessionImages>
    </MuscuLayout>
  )
}

function Logger({ a, b }: { a: ExerciseView; b: ExerciseView }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [stopping, setStopping] = useState(false)
  const entries = { a, b }
  // Bodyweight exercises: the weights typed are added load (Lest) or help (Aide, stored negative).
  const [modeA, chooseA] = useLoadMode(a)
  const [modeB, chooseB] = useLoadMode(b)
  const modes = { a: modeA, b: modeB }
  const choose = { a: chooseA, b: chooseB }
  const rows = interleaveSets(a.sets, b.sets)
  // The first set not done yet, in superset order, is the one to do now.
  const current = rows.find((r) => !r.set.done)
  const doneCount = rows.filter((r) => r.set.done).length
  const allDone = doneCount === rows.length

  const toList = () => (location.key !== 'default' ? navigate(-1) : navigate(sessionPath(a.sessionId)))

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

  const saveSet = (which: 'a' | 'b', index: number, weight: number | null, reps: number | null, done: boolean) => {
    const mode = modes[which]
    return run((session) =>
      saveLocalSet(
        session,
        entries[which].id,
        index,
        { weight: weight === null || mode === null ? weight : signedWeight(weight, mode), reps, done },
      ),
    )
  }

  /** Lest ↔ Aide: the sets already logged for that exercise are saved again with the other sign. */
  async function switchMode(which: 'a' | 'b', next: LoadMode) {
    choose[which](next)
    const logged = setsToFlip(entries[which].sets, next)
    if (logged.length === 0) return
    const id = entries[which].id
    const saved = await run((session) =>
      logged.reduce((s, { index, weight, reps }) => saveLocalSet(s, id, index, { weight, reps, done: true }), session),
    )
    if (!saved) choose[which](null)
  }

  const setEasy = (which: 'a' | 'b', easy: boolean) =>
    run((session) => updateExercise(session, entries[which].id, { easy }))

  /** Terminé (every set done) or, after confirmation, earlier: each exercise with a validated set is completed. */
  async function complete() {
    const saved = await run((session) =>
      [a, b].reduce((s, entry) => updateExercise(s, entry.id, { completed: entry.completed || entry.sets.some((x) => x.done) }), session),
    )
    if (saved) toList()
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
            <div key={entry.id} className={styles.exercise}>
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
            </div>
          )
        })}
      </div>

      <SetTable
        wide
        // One column for both exercises: titled "Aide kg" only when every weight in it is help.
        assist={modeA === 'assist' && modeB === 'assist'}
        top={
          (modeA || modeB) &&
          (['a', 'b'] as const).map((which) => {
            const mode = modes[which]
            return (
              mode && (
                <LoadToggle
                  key={which}
                  mode={mode}
                  disabled={busy}
                  label={fr.muscu.superset.loadTypeOf(entries[which].exercise.name)}
                  badge={<SupersetBadge letter={LETTERS[which]} size="sm" />}
                  onChange={(next) => switchMode(which, next)}
                />
              )
            )
          })
        }
      >
        {rows.map(({ exercise, index, set }) => {
          const label = fr.muscu.superset.set(LETTERS[exercise], index + 1)
          const mode = modes[exercise]
          return (
            <SetRow
              // Fresh inputs whenever the row is validated or reopened.
              key={`${exercise}${index}-${set.done}`}
              set={mode ? setInMode(set, mode) : set}
              index={
                <>
                  <SupersetBadge letter={LETTERS[exercise]} size="sm" />
                  {index + 1}
                </>
              }
              labels={{
                weight: mode === 'assist' ? fr.muscu.superset.assistOf(label) : fr.muscu.superset.weightOf(label),
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
                    {formatSets(lastTime.sets, modes[which] !== null).map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </span>
                </div>
              )
            )
          })}
        </div>
      )}

      <div className={common.easy}>
        {(['a', 'b'] as const).map((which) => (
          <EasyToggle
            key={which}
            pressed={entries[which].easy}
            disabled={busy}
            label={fr.muscu.superset.easyOf(entries[which].exercise.name)}
            badge={<SupersetBadge letter={LETTERS[which]} />}
            onChange={(easy) => setEasy(which, easy)}
          />
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
