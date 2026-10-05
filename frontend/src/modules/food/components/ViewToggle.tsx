import { NavLink } from 'react-router-dom'
import { fr } from '../../../i18n/fr'
import styles from './ViewToggle.module.css'

/** Jour / Semaine switch; each side keeps the day or week being viewed. */
export function ViewToggle({ dayTo, weekTo }: { dayTo: string; weekTo: string }) {
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? styles.active : styles.option)
  return (
    <nav className={styles.toggle}>
      <NavLink to={dayTo} className={cls}>
        {fr.view.day}
      </NavLink>
      <NavLink to={weekTo} className={cls}>
        {fr.view.week}
      </NavLink>
    </nav>
  )
}
