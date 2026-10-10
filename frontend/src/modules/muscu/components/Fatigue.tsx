import type { Muscle } from '../../../api/generated/model'
import { Battery } from '../../../core/ui/icons'
import { fr } from '../../../i18n/fr'
import styles from './Fatigue.module.css'

/** Battery icon next to a pre-fatigued exercise (icon only: it carries the label). */
export function FatigueIcon({ size = 16 }: { size?: number }) {
  return (
    <span className={styles.icon} role="img" aria-label={fr.muscu.session.fatigued} title={fr.muscu.session.fatigued}>
      <Battery size={size} />
    </span>
  )
}

/** "Dos déjà travaillé" under the exercise name. */
export function FatigueTag({ muscles }: { muscles: Muscle[] }) {
  const names = muscles.map((m, i) => {
    const label = fr.muscu.muscles[m]
    return i === 0 ? label : label.toLocaleLowerCase('fr-FR')
  })
  return (
    <span className={styles.tag}>
      <Battery size={14} />
      {fr.muscu.session.alreadyWorked(names.join(', '), names.length)}
    </span>
  )
}
