import styles from './SupersetBadge.module.css'

interface SupersetBadgeProps {
  /** A: first exercise of the superset, B: second. */
  letter: 'A' | 'B'
  size?: 'sm' | 'md'
}

/** Letter badge of an exercise in a superset. */
export function SupersetBadge({ letter, size = 'md' }: SupersetBadgeProps) {
  return (
    <span className={`${styles.badge} ${letter === 'B' ? styles.b : ''} ${size === 'sm' ? styles.sm : ''}`}>{letter}</span>
  )
}
