import type { ReactNode } from 'react'
import { fr } from '../../../i18n/fr'
import { LOAD_MODES, type LoadMode } from '../loadMode'
import styles from './LoadToggle.module.css'

interface LoadToggleProps {
  mode: LoadMode
  disabled: boolean
  label: string
  /** Superset: the A/B badge of the exercise. */
  badge?: ReactNode
  onChange: (mode: LoadMode) => void
}

const LABELS: Record<LoadMode, string> = { load: fr.muscu.session.lest, assist: fr.muscu.session.assist }

/** Lest | Aide: whether the weight typed for a bodyweight exercise is added load or help from an assisted machine. */
export function LoadToggle({ mode, disabled, label, badge, onChange }: LoadToggleProps) {
  return (
    <div className={styles.toggle}>
      {badge}
      <div className={styles.group} role="group" aria-label={label}>
        {LOAD_MODES.map((value) => (
          <button
            key={value}
            type="button"
            className={`${styles.option} ${value === mode ? styles.on : ''}`}
            aria-pressed={value === mode}
            disabled={disabled}
            onClick={() => value !== mode && onChange(value)}
          >
            {LABELS[value]}
          </button>
        ))}
      </div>
    </div>
  )
}
