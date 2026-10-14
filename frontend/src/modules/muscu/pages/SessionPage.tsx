import { blockStatus, toBlocks } from '@healthmanager/shared'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { sessionsFinish, sessionsRemove } from '../../../api/generated/endpoints/sessions/sessions'
import { httpStatus, isNetworkError, isNotFound } from '../../../api/http'
import { invalidateData } from '../../../core/dataVersion'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { Check, ChevronRight, Close, CloudOff } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useOnline } from '../../../core/useOnline'
import { fr } from '../../../i18n/fr'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExerciseThumb } from '../components/ExerciseThumb'
import { MuscuLayout } from '../components/MuscuLayout'
import { SupersetBadge } from '../components/SupersetBadge'
import { entryStatus, finishBody, type LocalSession } from '../offline/localSession'
import { SessionImages } from '../offline/SessionImages'
import { clearLocalSession, resumeSession, useLocalSession } from '../offline/store'
import { MUSCU_PATH, sessionExercisePath, sessionSupersetPath } from '../routes'
import page from './page.module.css'
import styles from './SessionPage.module.css'

/** Séance — liste: the exercises of the session in progress, done in any order, from the local copy. */
export default function SessionPage() {
  const { sessionId = '' } = useParams()
  const local = useLocalSession()

  // Another session is in progress on this device: that one comes first.
  if (local && local.id !== sessionId) return <Navigate to={MUSCU_PATH} replace />
  return (
    <MuscuLayout>
      {local ? (
        <SessionImages>
          <SessionList session={local} />
        </SessionImages>
      ) : (
        local === null && <Resume sessionId={sessionId} />
      )}
    </MuscuLayout>
  )
}

/** A session in progress on the server but not on this device: its bundle is loaded here (needs the connection). */
function Resume({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<'loading' | 'gone' | 'offline' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    resumeSession(sessionId).catch((error: unknown) => {
      if (isNetworkError(error)) setState('offline')
      else if (httpStatus(error) === 404 || httpStatus(error) === 409) setState('gone')
      else setState('error')
    })
  }, [sessionId, attempt])

  // Finished or discarded meanwhile: nothing to resume.
  if (state === 'gone') return <Navigate to={MUSCU_PATH} replace />
  if (state === 'loading') return null
  return (
    <div className={page.alert} role="alert">
      <span className={form.error}>{state === 'offline' ? fr.common.noConnection : fr.common.loadError}</span>
      <button
        type="button"
        className={form.secondary}
        onClick={() => {
          setState('loading')
          setAttempt((n) => n + 1)
        }}
      >
        {fr.common.retry}
      </button>
    </div>
  )
}

function SessionList({ session }: { session: LocalSession }) {
  const navigate = useNavigate()
  const online = useOnline()
  const [quit, setQuit] = useState<'closed' | 'open' | 'busy' | 'error' | 'offline'>('closed')
  const [finishing, setFinishing] = useState<'idle' | 'busy' | 'error' | 'offline'>('idle')
  // A superset is one card, and counts as one.
  const entries = session.exercises.map((e) => ({ ...e, status: entryStatus(e), group: e.supersetGroup }))
  const blocks = toBlocks(entries)
  const done = blocks.filter((block) => blockStatus(block.map((e) => e.status)) === 'done').length
  const logged = entries.some((e) => e.status !== 'todo')

  /** Leaves the session: the local copy is deleted only once the server agreed (or no longer has it). */
  async function leave(request: () => Promise<unknown>): Promise<'offline' | 'error' | null> {
    try {
      await request()
    } catch (error) {
      if (isNetworkError(error)) return 'offline'
      if (!isNotFound(error)) return 'error'
    }
    await clearLocalSession()
    invalidateData()
    navigate(MUSCU_PATH, { replace: true })
    return null
  }

  async function discard() {
    setQuit('busy')
    const failed = await leave(() => sessionsRemove(session.id))
    if (failed) setQuit(failed)
  }

  async function finish() {
    setFinishing('busy')
    const failed = await leave(() => sessionsFinish(session.id, finishBody(session)))
    if (failed) setFinishing(failed)
  }

  return (
    <>
      <header className={page.header}>
        <button
          type="button"
          className={page.iconButton}
          aria-label={online ? fr.muscu.session.quit : fr.muscu.session.quitOffline}
          disabled={!online}
          // Nothing logged yet: nothing to lose, no question.
          onClick={() => (logged ? setQuit('open') : discard())}
        >
          <Close />
        </button>
        <div className={styles.titleBlock}>
          <h1 className={page.title}>{session.workoutName}</h1>
          <div className={styles.progress}>{fr.muscu.session.progress(done, blocks.length)}</div>
        </div>
        {online ? (
          <span className={page.spacer} />
        ) : (
          <span className={styles.offline} role="img" aria-label={fr.common.noConnection}>
            <CloudOff />
          </span>
        )}
      </header>

      <ul className={styles.cards}>
        {blocks.map((block) => {
          const [entry, second] = block
          const status = blockStatus(block.map((e) => e.status))
          return (
            <li key={entry.id}>
              <Link
                to={second ? sessionSupersetPath(session.id, entry.id) : sessionExercisePath(session.id, entry.id)}
                className={`${styles.card} ${status === 'inProgress' ? styles.current : ''}`}
              >
                {second ? (
                  <>
                    <span className={styles.stack}>
                      <ExerciseImage exercise={entry.exercise} className={styles.stacked} />
                      <ExerciseImage exercise={second.exercise} className={styles.stacked} />
                    </span>
                    <span className={styles.pair}>
                      <span className={styles.supersetLabel}>{fr.muscu.superset.label}</span>
                      {block.map((e, k) => (
                        <span key={e.id} className={`${styles.name} ${status === 'done' ? styles.doneName : ''}`}>
                          <SupersetBadge letter={k === 0 ? 'A' : 'B'} size="sm" />
                          {e.exercise.name}
                        </span>
                      ))}
                    </span>
                  </>
                ) : (
                  <>
                    <ExerciseThumb exercise={entry.exercise} />
                    <span className={`${styles.name} ${status === 'done' ? styles.doneName : ''}`}>
                      {entry.exercise.name}
                    </span>
                  </>
                )}
                {status === 'done' && (
                  <span className={styles.doneIcon} role="img" aria-label={fr.muscu.session.done}>
                    <Check size={16} />
                  </span>
                )}
                {status === 'inProgress' && <span className={styles.tag}>{fr.muscu.session.inProgress}</span>}
                {status === 'todo' && <ChevronRight size={18} className={styles.chevron} />}
              </Link>
            </li>
          )
        })}
      </ul>

      {(finishing === 'error' || finishing === 'offline') && (
        <div className={form.error} role="alert">
          {finishing === 'offline' ? fr.common.noConnection : fr.common.saveError}
        </div>
      )}
      <button
        type="button"
        className={styles.finish}
        aria-label={online ? undefined : fr.muscu.session.finishOffline}
        disabled={!online || finishing === 'busy'}
        onClick={finish}
      >
        {!online && <CloudOff size={18} />}
        {fr.muscu.session.finish}
      </button>

      {quit !== 'closed' && (
        <ConfirmSheet
          title={fr.muscu.session.confirmQuit}
          confirmLabel={fr.muscu.session.quitAction}
          busy={quit === 'busy'}
          error={quit === 'offline' ? fr.common.noConnection : quit === 'error' ? fr.common.saveError : null}
          onConfirm={discard}
          onCancel={() => setQuit('closed')}
        />
      )}
    </>
  )
}
