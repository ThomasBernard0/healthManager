import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { exercisesList } from '../../../api/generated/endpoints/exercises/exercises'
import { programsList } from '../../../api/generated/endpoints/programs/programs'
import { sessionsCurrent } from '../../../api/generated/endpoints/sessions/sessions'
import { workoutsList } from '../../../api/generated/endpoints/workouts/workouts'
import type { ExerciseDto, ProgramSummaryDto, SessionDto, WorkoutSummaryDto } from '../../../api/generated/model'
import { useDataVersion } from '../../../core/dataVersion'
import { ChevronRight, Play } from '../../../core/ui/icons'
import { ModuleSwitcher } from '../../../core/ui/ModuleSwitcher'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useIsDesktop } from '../../../core/useIsDesktop'
import { useOverlayParam } from '../../../core/useOverlayParam'
import { fr } from '../../../i18n/fr'
import { ExerciseRow } from '../components/ExerciseRow'
import { MuscuLayout } from '../components/MuscuLayout'
import { NewProgramSheet, ProgramRows, WorkoutRows } from '../components/ProgramLists'
import { formatSessionDate, formatTargets } from '../format'
import { NEW_WORKOUT_PATH, programPath, sessionPath } from '../routes'
import { useStartSession } from '../useStartSession'
import page from './page.module.css'
import styles from './HomePage.module.css'

/**
 * Musculation Accueil: the next workout of the active program, Mes exercices (of the active program) and
 * Mes programmes (the active one with its séances, then the others with Activer).
 */
export default function HomePage() {
  const desktop = useIsDesktop()
  const version = useDataVersion()
  const workouts = useAsync(() => workoutsList(), `workouts#${version}`)
  const programs = useAsync(() => programsList(), `programs#${version}`)
  const current = useAsync(() => sessionsCurrent(), `current#${version}`)
  const next = workouts.data?.find((w) => w.isNext)
  const inProgress = current.data?.session ?? null
  // Wait for both, so Démarrer never starts a second session.
  const ready = workouts.data && current.data
  const exercises = useAsync(() => exercisesList(), `exercises#${version}`)
  const mine = exercises.data ?? []

  const failed = [workouts, programs].find((r) => r.status === 'error' && !r.data)
  const error = failed && (
    <div className={page.alert} role="alert">
      <span className={form.error}>{fr.common.loadError}</span>
      <button
        type="button"
        className={form.secondary}
        onClick={() => {
          workouts.reload()
          programs.reload()
        }}
      >
        {fr.common.retry}
      </button>
    </div>
  )
  const loaded = workouts.data && programs.data

  if (desktop) {
    return (
      <MuscuLayout width="wide">
        {error}
        {loaded && (
          <div className={styles.columns}>
            {/* Left: what to do next, then the programs. Right: my exercises. */}
            <div className={`${styles.column} ${styles.stack}`}>
              {ready && (inProgress || next) && <NextCard workout={next} inProgress={inProgress} desktop />}
              <MyPrograms programs={programs.data!} workouts={workouts.data!} />
            </div>
            <div className={styles.column}>
              <MyExercises exercises={mine} />
            </div>
          </div>
        )}
      </MuscuLayout>
    )
  }

  return (
    <MuscuLayout>
      <ModuleSwitcher current="muscu" />
      {error}
      {loaded && (
        <>
          {ready && (inProgress || next) && <NextCard workout={next} inProgress={inProgress} />}
          <MyExercises exercises={mine} />
          <MyPrograms programs={programs.data!} workouts={workouts.data!} />
        </>
      )}
    </MuscuLayout>
  )
}

/** Mes programmes: the active one on top with its séances (rotation), the others below with Activer. */
function MyPrograms({ programs, workouts }: { programs: ProgramSummaryDto[]; workouts: WorkoutSummaryDto[] }) {
  const creating = useOverlayParam('ajout')
  const active = programs.find((p) => p.active)
  const others = programs.filter((p) => !p.active)
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{fr.muscu.home.myPrograms}</h2>
      {active && (
        <div className={styles.listCard}>
          <Link to={programPath(active.id)} className={styles.programHeader}>
            <span className={styles.programName}>{active.name}</span>
            <span className={styles.upNext}>{fr.muscu.program.active}</span>
            <ChevronRight size={18} className={styles.chevron} />
          </Link>
          <WorkoutRows workouts={workouts} />
        </div>
      )}
      <Link to={NEW_WORKOUT_PATH} className={styles.newWorkout}>
        {fr.muscu.home.newWorkout}
      </Link>
      {others.length > 0 && (
        <div className={styles.listCard}>
          <ProgramRows programs={others} />
        </div>
      )}
      <button type="button" className={styles.newWorkout} onClick={() => creating.open('programme')}>
        {fr.muscu.home.newProgram}
      </button>
      {creating.value === 'programme' && <NewProgramSheet onClose={creating.close} />}
    </section>
  )
}

/**
 * Mes exercices: each exercise once, by name, opening its Fiche (progression, history). Tabs: the active program's,
 * and those only in other programs.
 */
function MyExercises({ exercises }: { exercises: ExerciseDto[] }) {
  const [tab, setTab] = useState<'active' | 'others'>('active')
  const active = exercises.filter((e) => e.workouts.some((w) => w.programActive))
  const others = exercises.filter((e) => e.workouts.length > 0 && !e.workouts.some((w) => w.programActive))
  if (active.length === 0 && others.length === 0) return null
  const shown = others.length > 0 && tab === 'others' ? others : active
  const tabs = [
    ['active', fr.muscu.home.activeExercises],
    ['others', fr.muscu.home.otherExercises],
  ] as const
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{fr.muscu.home.myExercises}</h2>
      {others.length > 0 && (
        <div className={styles.segmented}>
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={tab === value ? styles.segmentActive : styles.segment}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <ul className={page.list}>
          {shown.map((e) => (
            <ExerciseRow key={e.id} exercise={e} link />
          ))}
        </ul>
      )}
    </section>
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
  // Targets: the next workout only (desktop list).
  const exercises = inProgress
    ? inProgress.exercises.map((e) => ({ name: e.exercise.name, targets: null }))
    : workout!.exercises
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
          {exercises.map((e) => (
            <li key={e.name}>
              <span>{e.name}</span>
              {e.targets && <span className={styles.nextTargets}>{formatTargets(e.targets)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.nextExercises}>{exercises.map((e) => e.name).join(', ')}</div>
      )}
      {status === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.saveError}
        </div>
      )}
      <button
        type="button"
        className={styles.start}
        disabled={status === 'busy' || (!inProgress && workout!.exercises.length === 0)}
        onClick={() => (inProgress ? navigate(sessionPath(inProgress.id)) : start(workout!.id))}
      >
        <Play />
        {inProgress ? fr.muscu.session.resume : fr.muscu.home.start}
      </button>
    </section>
  )
}
