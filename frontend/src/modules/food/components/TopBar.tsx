import { fr } from '../../../i18n/fr'
import { ChevronLeft, ChevronRight } from '../../../core/ui/icons'
import { ViewToggle } from './ViewToggle'
import styles from './TopBar.module.css'

interface TopBarProps {
  /** "Dimanche 4 octobre" or "Lun 28 sept – Dim 4 oct" */
  label: string
  previousLabel: string
  nextLabel: string
  onPrevious: () => void
  /** Already at the first day (or week) with data. */
  previousDisabled?: boolean
  onNext: () => void
  /** "Aujourd'hui" / "Cette semaine" shortcut */
  currentLabel: string
  onCurrent: () => void
  dayTo: string
  weekTo: string
}

/** Desktop top bar: module title, period switcher with a "now" shortcut, Jour/Semaine toggle. */
export function TopBar(props: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.title}>{fr.app.title}</div>
        <div className={styles.switcher}>
          <button type="button" className={styles.arrow} aria-label={props.previousLabel}
            disabled={props.previousDisabled}
            onClick={props.onPrevious}
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className={styles.label}>{props.label}</h1>
          <button type="button" className={styles.arrow} aria-label={props.nextLabel} onClick={props.onNext}>
            <ChevronRight size={18} />
          </button>
          <button type="button" className={styles.current} onClick={props.onCurrent}>
            {props.currentLabel}
          </button>
        </div>
        <div className={styles.toggle}>
          <ViewToggle dayTo={props.dayTo} weekTo={props.weekTo} />
        </div>
      </div>
    </header>
  )
}
