import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { exercisesList } from '../../../api/generated/endpoints/exercises/exercises'
import { programsList } from '../../../api/generated/endpoints/programs/programs'
import { sessionsCurrent } from '../../../api/generated/endpoints/sessions/sessions'
import { tonnageSummary } from '../../../api/generated/endpoints/tonnage/tonnage'
import { workoutsList } from '../../../api/generated/endpoints/workouts/workouts'
import type { ExerciseDto, ProgramSummaryDto, TonnageDto, WorkoutSummaryDto } from '../../../api/generated/model'
import { useDataVersion } from '../../../core/dataVersion'
import { ChevronRight, Dumbbell, Play, Plus } from '../../../core/ui/icons'
import { ModuleSwitcher } from '../../../core/ui/ModuleSwitcher'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useIsDesktop } from '../../../core/useIsDesktop'
import { useOnline } from '../../../core/useOnline'
import { useOverlayParam } from '../../../core/useOverlayParam'
import { fr } from '../../../i18n/fr'
import { ExerciseRow } from '../components/ExerciseRow'
import { MuscuLayout } from '../components/MuscuLayout'
import { NewProgramSheet, ProgramRows, WorkoutRows } from '../components/ProgramLists'
import { formatSessionDate, formatTargets, formatTonnage } from '../format'
import { useLocalSession } from '../offline/store'
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
  // A session in progress on this device comes first (it works offline); else the one on the server, if any.
  const local = useLocalSession()
  const current = useAsync(
    () => (local === null ? sessionsCurrent() : Promise.resolve({ session: null })),
    `current#${version}#${local === null}`,
  )
  const next = workouts.data?.find((w) => w.isNext)
  const server = current.data?.session
  const inProgress: InProgress | null = local
    ? { id: local.id, workoutName: local.workoutName, exercises: local.exercises.map((e) => e.exercise.name) }
    : server
      ? { id: server.id, workoutName: server.workoutName, exercises: server.exercises.map((e) => e.exercise.name) }
      : null
  // Wait for both, so Démarrer never starts a second session.
  const ready = workouts.data && local !== undefined && (local || current.data)
  const exercises = useAsync(() => exercisesList(), `exercises#${version}`)
  const tonnage = useAsync(() => tonnageSummary(), `tonnage#${version}`)
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
        {local && !loaded && <NextCard workout={undefined} inProgress={inProgress} desktop />}
        {loaded && (
          <div className={styles.columns}>
            {/* Left: what to do next, then the programs. Right: my exercises. */}
            <div className={`${styles.column} ${styles.stack}`}>
              {ready && (inProgress || next) && <NextCard workout={next} inProgress={inProgress} desktop />}
              {tonnage.data && <TonnageCard tonnage={tonnage.data} />}
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
      {local && !loaded && <NextCard workout={undefined} inProgress={inProgress} />}
      {loaded && (
        <>
          {ready && (inProgress || next) && <NextCard workout={next} inProgress={inProgress} />}
          {tonnage.data && <TonnageCard tonnage={tonnage.data} />}
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
          {workouts.length > 0 && <WorkoutRows workouts={workouts} />}
          {/* Last row of the card: the new séance goes into this program. */}
          <Link to={NEW_WORKOUT_PATH} className={styles.newWorkoutRow}>
            <span className={styles.newWorkoutBadge}>
              <Plus size={14} strokeWidth={2.4} />
            </span>
            {fr.muscu.home.newWorkout}
          </Link>
        </div>
      )}
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

/** The session in progress: its workout and the names of its exercises. */
interface InProgress {
  id: string
  workoutName: string
  exercises: string[]
}

interface NextCardProps {
  workout: WorkoutSummaryDto | undefined
  /** A session in progress replaces the next workout: Reprendre. */
  inProgress: InProgress | null
  desktop?: boolean
}

function NextCard({ workout, inProgress, desktop = false }: NextCardProps) {
  const navigate = useNavigate()
  const { start, status } = useStartSession()
  const online = useOnline()
  const name = inProgress ? inProgress.workoutName : workout!.name
  // Targets: the next workout only (desktop list).
  const exercises = inProgress
    ? inProgress.exercises.map((name) => ({ name, targets: null }))
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
      {(status === 'error' || status === 'offline') && (
        <div className={form.error} role="alert">
          {status === 'offline' ? fr.common.noConnection : fr.common.saveError}
        </div>
      )}
      <button
        type="button"
        className={styles.start}
        // Démarrer needs the connection; Reprendre a session kept on this device doesn't.
        disabled={status === 'busy' || (!inProgress && (!online || workout!.exercises.length === 0))}
        onClick={() => (inProgress ? navigate(sessionPath(inProgress.id)) : start(workout!.id))}
      >
        <Play />
        {inProgress ? fr.muscu.session.resume : fr.muscu.home.start}
      </button>
    </section>
  )
}

/** Tonnage soulevé: all time, and this week on the right (bodyweight exercises not counted). */
function TonnageCard({ tonnage }: { tonnage: TonnageDto }) {
  return (
    <section className={styles.tonnageCard} aria-label={fr.muscu.tonnage.title}>
      <span className={styles.tonnageIcon}>
        <Dumbbell />
      </span>
      <div className={styles.tonnageText}>
        <span className={styles.tonnageLabel}>{fr.muscu.tonnage.title}</span>
        <span className={styles.tonnageTotal}>{formatTonnage(tonnage.totalKg)}</span>
      </div>
      <span className={styles.tonnageWeek}>
        {fr.muscu.tonnage.added(formatTonnage(tonnage.weekKg))}
        <br />
        {fr.muscu.tonnage.thisWeek}
      </span>
    </section>
  )
}
