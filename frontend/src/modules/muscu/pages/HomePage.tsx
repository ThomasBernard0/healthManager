import { Link } from 'react-router-dom'
import { ModuleSwitcher } from '../../../core/ui/ModuleSwitcher'
import { useIsDesktop } from '../../../core/useIsDesktop'
import { fr } from '../../../i18n/fr'
import { MuscuLayout } from '../components/MuscuLayout'
import { EXERCISES_PATH } from '../routes'
import styles from './HomePage.module.css'

/** Musculation Accueil: next workout and the rotation (filled in by the next steps). */
export default function HomePage() {
  const desktop = useIsDesktop()

  return (
    <MuscuLayout width="wide">
      {!desktop && (
        <div className={styles.top}>
          <ModuleSwitcher current="muscu" />
          <Link to={EXERCISES_PATH} className={styles.link}>
            {fr.muscu.exercises}
          </Link>
        </div>
      )}
    </MuscuLayout>
  )
}
