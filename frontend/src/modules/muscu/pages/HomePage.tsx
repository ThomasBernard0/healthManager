import { useIsDesktop } from '../../../core/useIsDesktop'
import { ModuleSwitcher } from '../../../core/ui/ModuleSwitcher'
import styles from './HomePage.module.css'

/** Musculation Accueil: next workout and the rotation (filled in by the next steps). */
export default function HomePage() {
  const desktop = useIsDesktop()

  if (desktop) {
    return (
      <div className={styles.desktop}>
        <header className={styles.bar}>
          <div className={styles.barInner}>
            <ModuleSwitcher current="muscu" variant="desktop" />
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <ModuleSwitcher current="muscu" />
    </div>
  )
}
