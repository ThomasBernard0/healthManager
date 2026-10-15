import type { ReactNode } from 'react'
import styles from './Ring.module.css'

const R = 70
const CIRCUMFERENCE = 2 * Math.PI * R

interface RingProps {
  /** Eaten so far. */
  value: number
  /** null when no target is set: the ring stays empty. */
  target: number | null
  /** Forces the "over" colour (Finances: negative Reste). Default: value > target. */
  over?: boolean
  /** "desktop" is larger with a thinner stroke. */
  variant?: 'mobile' | 'desktop'
  /** Overrides the size (Finances). */
  className?: string
  children: ReactNode
}

/** Progress ring: fills with what was eaten; turns "over" colour past the target. */
export function Ring({ value, target, over, variant = 'mobile', className, children }: RingProps) {
  const fraction = target && target > 0 ? Math.min(Math.max(value / target, 0), 1) : 0
  const isOver = over ?? (target !== null && value > target)
  const strokeWidth = variant === 'desktop' ? 12 : 14

  return (
    <div className={`${styles.ring} ${variant === 'desktop' ? styles.desktop : ''} ${className ?? ''}`}>
      <svg viewBox="0 0 160 160" className={styles.svg} aria-hidden="true">
        <circle cx="80" cy="80" r={R} className={styles.track} strokeWidth={strokeWidth} />
        {fraction > 0 && (
          <circle
            cx="80"
            cy="80"
            r={R}
            className={isOver ? styles.over : styles.progress}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${(fraction * CIRCUMFERENCE).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
            transform="rotate(-90 80 80)"
          />
        )}
      </svg>
      <div className={styles.center}>{children}</div>
    </div>
  )
}
