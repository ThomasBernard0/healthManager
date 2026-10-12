import type { Feeling } from '../../../api/generated/model'
import { fr } from '../../../i18n/fr'
import styles from './FeelingButtons.module.css'

const FEELINGS: Feeling[] = ['easy', 'ok', 'hard']

interface FeelingButtonsProps {
  value: Feeling | null
  disabled: boolean
  /** Tapping the selected one clears it. */
  onChange: (feeling: Feeling | null) => void
}

/** Ressenti: Facile / OK / Dur (three cells of the parent's grid). */
export function FeelingButtons({ value, disabled, onChange }: FeelingButtonsProps) {
  return (
    <>
      {FEELINGS.map((f) => (
        <button
          key={f}
          type="button"
          className={`${styles.button} ${value === f ? styles.selected : ''}`}
          aria-pressed={value === f}
          disabled={disabled}
          onClick={() => onChange(value === f ? null : f)}
        >
          {fr.muscu.session.feelings[f]}
        </button>
      ))}
    </>
  )
}
