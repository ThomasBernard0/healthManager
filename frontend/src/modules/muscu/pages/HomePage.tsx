import { Link, useNavigate } from 'react-router-dom'
import { sessionsCurrent } from '../../../api/generated/endpoints/sessions/sessions'
import { workoutsList } from '../../../api/generated/endpoints/workouts/workouts'
import type { SessionDto, WorkoutSummaryDto } from '../../../api/generated/model'
import { useDataVersion } from '../../../core/dataVersion'
import { ChevronRight, Play } from '../../../core/ui/icons'
import { ModuleSwitcher } from '../../../core/ui/ModuleSwitcher'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useIsDesktop } from '../../../core/useIsDesktop'
import { fr } from '../../../i18n/fr'
import { MuscuLayout } from '../components/MuscuLayout'
import { formatSessionDate } from '../format'
import { EXERCISES_PATH, NEW_WORKOUT_PATH, sessionPath, workoutPath } from '../routes'
import { useStartSession } from '../useStartSession'
import page from './page.module.css'
import styles from './HomePage.module.css'

/** Musculation Accueil: the next workout of the rotation, and the rotation (Mes séances). */
export default function HomePage() {
  const desktop = useIsDesktop()
  const version = useDataVersion()
  const workouts = useAsync(() => workoutsList(), `workouts#${version}`)
  const current = useAsync(() => sessionsCurrent(), `current#${version}`)
  const next = workouts.data?.find((w) => w.isNext)
  const inProgress = current.data?.session ?? null
  // Wait for both, so Démarrer never starts a second session.
  const ready = workouts.data && current.data

  const error = workouts.status === 'error' && !workouts.data && (
    <div className={page.alert} role="alert">
      <span className={form.error}>{fr.common.loadError}</span>
      <button type="button" className={form.secondary} onClick={workouts.reload}>
        {fr.common.retry}
      </button>
    </div>
  )

  if (desktop) {
    return (
      <MuscuLayout width="wide">
        {error}
        {workouts.data && (
          <div className={styles.columns}>
            <section className={styles.column}>{ready && (inProgress || next) && <NextCard workout={next} inProgress={inProgress} desktop />}</section>
            <section className={`${styles.column} ${styles.listCard}`}>
              <div className={styles.listHeader}>
                <h2 className={styles.sectionTitle}>{fr.muscu.home.myWorkouts}</h2>
                <Link to={NEW_WORKOUT_PATH} className={styles.newSmall}>
                  {fr.muscu.home.newWorkout}
                </Link>
              </div>
              <WorkoutRows workouts={workouts.data} />
            </section>
          </div>
        )}
      </MuscuLayout>
    )
  }

  return (
    <MuscuLayout>
      <ModuleSwitcher current="muscu" />
      {error}
      {workouts.data && (
        <>
          {ready && (inProgress || next) && <NextCard workout={next} inProgress={inProgress} />}
          <section className={styles.section}>
            <div className={styles.listHeader}>
              <h2 className={styles.sectionTitle}>{fr.muscu.home.myWorkouts}</h2>
              <Link to={EXERCISES_PATH} className={styles.link}>
                {fr.muscu.exercises}
              </Link>
            </div>
            {workouts.data.length > 0 && (
              <div className={styles.listCard}>
                <WorkoutRows workouts={workouts.data} />
              </div>
            )}
            <Link to={NEW_WORKOUT_PATH} className={styles.newWorkout}>
              {fr.muscu.home.newWorkout}
            </Link>
          </section>
        </>
      )}
    </MuscuLayout>
  )
}

interface NextCardProps {
  workout: WorkoutSummaryDto | undefined
  /** A session in progress replaces the next workout: Reprendre. */
  inProgress: SessionDto | null
  desktop?: boolean
}

function NextCard({ workout, inProgress, desktop = false }: NextCardProps) {
  const navigate = useNavigate()
  const { start, status } = useStartSession()
  const name = inProgress ? inProgress.workoutName : workout!.name
  const exercises = inProgress ? inProgress.exercises.map((e) => e.exercise.name) : workout!.exerciseNames
  return (
    <section className={styles.nextCard} aria-label={inProgress ? fr.muscu.home.inProgress : fr.muscu.home.next}>
      <div className={styles.nextTop}>
        <span>{inProgress ? fr.muscu.home.inProgress : fr.muscu.home.next}</span>
        {!inProgress && workout?.lastDoneOn && (
          <span>{fr.muscu.home.lastDone(formatSessionDate(workout.lastDoneOn))}</span>
        )}
      </div>
      <div className={styles.nextName}>{name}</div>
      {desktop ? (
        <ul className={styles.nextList}>
          {exercises.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : (
        <div className={styles.nextExercises}>{exercises.join(', ')}</div>
      )}
      {status === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.saveError}
        </div>
      )}
      <button
        type="button"
        className={styles.start}
        disabled={status === 'busy' || (!inProgress && workout!.exerciseNames.length === 0)}
        onClick={() => (inProgress ? navigate(sessionPath(inProgress.id)) : start(workout!.id))}
      >
        <Play />
        {inProgress ? fr.muscu.session.resume : fr.muscu.home.start}
      </button>
    </section>
  )
}

function WorkoutRows({ workouts }: { workouts: WorkoutSummaryDto[] }) {
  return (
    <ul className={styles.rows}>
      {workouts.map((w) => (
        <li key={w.id}>
          <Link to={workoutPath(w.id)} className={styles.row}>
            <span className={`${styles.position} ${w.isNext ? styles.positionNext : ''}`}>{w.position}</span>
            <span className={styles.rowText}>
              <span className={styles.rowName}>{w.name}</span>
              <span className={styles.rowMeta}>
                {[fr.muscu.home.exerciseCount(w.exerciseNames.length), w.lastDoneOn && formatSessionDate(w.lastDoneOn)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            {w.isNext && <span className={styles.upNext}>{fr.muscu.home.upNext}</span>}
            <ChevronRight size={18} className={styles.chevron} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
