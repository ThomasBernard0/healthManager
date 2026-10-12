import type { ReactNode } from 'react'
import { Bolt } from '../../../core/ui/icons'
import { fr } from '../../../i18n/fr'
import styles from './EasyToggle.module.css'

interface EasyToggleProps {
  pressed: boolean
  disabled: boolean
  label: string
  /** Superset: the A/B badge of the exercise. */
  badge?: ReactNode
  onChange: (easy: boolean) => void
}

/** Facile: one optional toggle (a clear margin, the weight goes up next time). */
export function EasyToggle({ pressed, disabled, label, badge, onChange }: EasyToggleProps) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${pressed ? styles.on : ''}`}
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!pressed)}
    >
      {badge}
      <Bolt size={18} strokeWidth={2.2} />
      {fr.muscu.session.easy}
    </button>
  )
}
