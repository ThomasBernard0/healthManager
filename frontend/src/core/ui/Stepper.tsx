import type { ReactNode } from 'react'
import { Minus, Plus } from './icons'
import styles from './Stepper.module.css'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  step: number
  min: number
  max: number
  decreaseLabel: string
  increaseLabel: string
  children: ReactNode
  size?: 'md' | 'lg'
}

/** − value + */
export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  decreaseLabel,
  increaseLabel,
  children,
  size = 'md',
}: StepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  return (
    <div className={`${styles.stepper} ${size === 'lg' ? styles.lg : ''}`}>
      <button
        type="button"
        className={styles.button}
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
      >
        <Minus />
      </button>
      <div className={styles.value} aria-live="polite">
        {children}
      </div>
      <button
        type="button"
        className={styles.button}
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
      >
        <Plus />
      </button>
    </div>
  )
}
