import { blockStatus, toBlocks } from '@healthmanager/shared'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { sessionsFinish, sessionsGet, sessionsRemove } from '../../../api/generated/endpoints/sessions/sessions'
import type { SessionDto } from '../../../api/generated/model'
import { invalidateData, useDataVersion } from '../../../core/dataVersion'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { Check, ChevronRight, Close, Pencil } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { ExerciseDrawing } from '../components/ExerciseDrawing'
import { ExerciseThumb } from '../components/ExerciseThumb'
import { MuscuLayout } from '../components/MuscuLayout'
import { SupersetBadge } from '../components/SupersetBadge'
import { MUSCU_PATH, sessionExercisePath, sessionSupersetPath, workoutPath } from '../routes'
import page from './page.module.css'
import styles from './SessionPage.module.css'

/** Séance — liste: the exercises of the session in progress, done in any order. */
export default function SessionPage() {
  const { sessionId = '' } = useParams()
  const version = useDataVersion()
  const session = useAsync(() => sessionsGet(sessionId), `${sessionId}#${version}`)
  const data = session.data?.id === sessionId ? session.data : undefined

  if (data?.finishedAt) return <Navigate to={MUSCU_PATH} replace />
  if (session.status === 'error' && !data) {
    return (
      <MuscuLayout>
        <div className={page.alert} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={session.reload}>
            {fr.common.retry}
          </button>
        </div>
      </MuscuLayout>
    )
  }
  return <MuscuLayout>{data && <SessionList session={data} />}</MuscuLayout>
}

function SessionList({ session }: { session: SessionDto }) {
  const navigate = useNavigate()
  const [quit, setQuit] = useState<'closed' | 'open' | 'busy' | 'error'>('closed')
  const [finishing, setFinishing] = useState<'idle' | 'busy' | 'error'>('idle')
  // A superset is one card, and counts as one.
  const blocks = toBlocks(session.exercises.map((e) => ({ ...e, group: e.supersetGroup })))
  const done = blocks.filter((block) => blockStatus(block.map((e) => e.status)) === 'done').length
  const logged = session.exercises.some((e) => e.status !== 'todo')

  async function discard() {
    setQuit('busy')
    try {
      await sessionsRemove(session.id)
    } catch {
      setQuit('error')
      return
    }
    invalidateData()
    navigate(MUSCU_PATH, { replace: true })
  }

  async function finish() {
    setFinishing('busy')
    try {
      await sessionsFinish(session.id)
    } catch {
      setFinishing('error')
      return
    }
    invalidateData()
    navigate(MUSCU_PATH, { replace: true })
  }

  return (
    <>
      <header className={page.header}>
        <button
          type="button"
          className={page.iconButton}
          aria-label={fr.muscu.session.quit}
          // Nothing logged yet: nothing to lose, no question.
          onClick={() => (logged ? setQuit('open') : discard())}
        >
          <Close />
        </button>
        <div className={styles.titleBlock}>
          <h1 className={page.title}>{session.workoutName}</h1>
          <div className={styles.progress}>{fr.muscu.session.progress(done, blocks.length)}</div>
        </div>
        {session.workoutId ? (
          // Changes apply to the next sessions, not to this one.
          <Link
            to={workoutPath(session.workoutId)}
            className={`${page.iconButton} ${styles.edit}`}
            aria-label={fr.muscu.session.edit}
          >
            <Pencil size={18} />
          </Link>
        ) : (
          <span className={page.spacer} />
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
                      <ExerciseDrawing imageUrl={entry.exercise.imageUrl} className={styles.stacked} />
                      <ExerciseDrawing imageUrl={second.exercise.imageUrl} className={styles.stacked} />
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
                    <ExerciseThumb imageUrl={entry.exercise.imageUrl} />
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

      {finishing === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.saveError}
        </div>
      )}
      <button type="button" className={styles.finish} disabled={finishing === 'busy'} onClick={finish}>
        {fr.muscu.session.finish}
      </button>

      {quit !== 'closed' && (
        <ConfirmSheet
          title={fr.muscu.session.confirmQuit}
          confirmLabel={fr.muscu.session.quitAction}
          busy={quit === 'busy'}
          error={quit === 'error' ? fr.common.saveError : null}
          onConfirm={discard}
          onCancel={() => setQuit('closed')}
        />
      )}
    </>
  )
}
