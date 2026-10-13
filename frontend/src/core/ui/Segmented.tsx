import styles from './Segmented.module.css'

interface SegmentedProps<T extends string> {
  /** Accessible name of the group. */
  label?: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}

/** Full-width choice between a few options ("Pour 100 g | Par portion"). */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? styles.segmentActive : styles.segment}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
