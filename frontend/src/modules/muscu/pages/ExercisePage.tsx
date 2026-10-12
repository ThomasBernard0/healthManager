import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { addDays, parisToday } from '@healthmanager/shared'
import { exercisesGet, exercisesHistory } from '../../../api/generated/endpoints/exercises/exercises'
import { useDataVersion } from '../../../core/dataVersion'
import { ChevronLeft, Pencil } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useIsDesktop } from '../../../core/useIsDesktop'
import { fr } from '../../../i18n/fr'
import { ExerciseImage } from '../components/ExerciseImage'
import { HistoryList } from '../components/HistoryList'
import { MuscuLayout } from '../components/MuscuLayout'
import { ProgressionChart } from '../components/ProgressionChart'
import { exerciseDetails } from '../format'
import { editExercisePath, EXERCISES_PATH } from '../routes'
import page from './page.module.css'
import styles from './ExercisePage.module.css'

/** The Progression chart covers the last 12 weeks. */
const CHART_DAYS = 12 * 7

/** Fiche exercice: name, equipment · workouts, picture with its muscles, Progression, Historique. */
export default function ExercisePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const desktop = useIsDesktop()
  const version = useDataVersion()
  const exercise = useAsync(() => exercisesGet(id), `${id}#${version}`)
  const data = exercise.data?.id === id ? exercise.data : undefined
  const history = useAsync(() => exercisesHistory(id), `history#${id}#${version}`)
  const entries = history.data && data ? history.data : []
  const since = addDays(parisToday(), -CHART_DAYS)
  const chart = entries.filter((e) => e.date >= since).reverse()

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(EXERCISES_PATH))

  return (
    <MuscuLayout width="wide">
      <header className={`${page.header} ${desktop ? styles.desktopHeader : ''}`}>
        <button type="button" className={page.iconButton} aria-label={fr.common.back} onClick={back}>
          <ChevronLeft />
        </button>
        {desktop && data && <Heading name={data.name} details={exerciseDetails(data)} />}
        <Link to={editExercisePath(id)} className={page.iconButton} aria-label={fr.muscu.editExercise}>
          <Pencil size={20} strokeWidth={2} />
        </Link>
      </header>

      {exercise.status === 'error' && !data && (
        <div className={page.alert} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={exercise.reload}>
            {fr.common.retry}
          </button>
        </div>
      )}

      {data && (
        <>
          {!desktop && <Heading name={data.name} details={exerciseDetails(data)} />}
          <div className={styles.top}>
            <figure className={styles.image}>
              <ExerciseImage exercise={data} className={styles.drawing} />
              <figcaption className={styles.pills}>
                {data.primaryMuscles.map((m) => (
                  <span key={m} className={styles.primary}>
                    {fr.muscu.muscles[m]}
                  </span>
                ))}
                {data.secondaryMuscles.map((m) => (
                  <span key={m} className={styles.secondary}>
                    {fr.muscu.muscles[m]}
                  </span>
                ))}
              </figcaption>
            </figure>
            {chart.length > 0 && <ProgressionChart entries={chart} variant={desktop ? 'desktop' : 'mobile'} />}
          </div>
          {entries.length > 0 && <HistoryList entries={entries} variant={desktop ? 'desktop' : 'mobile'} />}
        </>
      )}
    </MuscuLayout>
  )
}

function Heading({ name, details }: { name: string; details: string }) {
  return (
    <div className={styles.heading}>
      <h1 className={styles.name}>{name}</h1>
      <div className={styles.meta}>{details}</div>
    </div>
  )
}
