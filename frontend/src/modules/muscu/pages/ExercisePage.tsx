import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { addDays, parisToday } from '@healthmanager/shared'
import { exercisesGet, exercisesHistory } from '../../../api/generated/endpoints/exercises/exercises'
import { tonnageSummary } from '../../../api/generated/endpoints/tonnage/tonnage'
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
import { exerciseDetails, formatTonnage } from '../format'
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
  const tonnage = useAsync(() => tonnageSummary({ exerciseId: id }), `tonnage#${id}#${version}`)
  // Not for bodyweight exercises (with or without help): their load is not the weight typed.
  const lifted = data && data.equipment !== 'bodyweight' && tonnage.data ? <Lifted kg={tonnage.data.totalKg} /> : null
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
        {desktop && lifted}
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
          {!desktop && (
            <div className={styles.titleRow}>
              <Heading name={data.name} details={exerciseDetails(data)} />
              {lifted}
            </div>
          )}
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

/** The exercise's tonnage: "12,4 t / soulevées". */
function Lifted({ kg }: { kg: number }) {
  return (
    <div className={styles.lifted}>
      <span className={styles.liftedValue}>{formatTonnage(kg)}</span>
      <span className={styles.liftedLabel}>{fr.muscu.tonnage.lifted}</span>
    </div>
  )
}
