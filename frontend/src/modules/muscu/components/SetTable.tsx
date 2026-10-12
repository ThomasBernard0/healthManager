import { useState, type ReactNode } from 'react'
import type { SessionSetDto } from '../../../api/generated/model'
import { parseNumber } from '../../../core/format'
import { Check } from '../../../core/ui/icons'
import { fr } from '../../../i18n/fr'
import { formatWeight } from '../format'
import styles from './SetTable.module.css'

interface SetTableProps {
  /** Superset rows ("A1"). */
  wide?: boolean
  /** Above the header, at the end: the Lest | Aide control of a bodyweight exercise. */
  top?: ReactNode
  /** The weights are help from an assisted machine: the column is titled "Aide kg". */
  assist?: boolean
  children: ReactNode
}

/** The card of set rows, under its Objectif | kg | Reps header. */
export function SetTable({ wide = false, top, assist = false, children }: SetTableProps) {
  return (
    <div className={`${styles.sets} ${wide ? styles.wide : ''}`}>
      {top && <div className={styles.top}>{top}</div>}
      <div className={`${styles.grid} ${styles.head}`} aria-hidden="true">
        <span />
        <span>{fr.muscu.session.target}</span>
        <span>{assist ? fr.muscu.session.assistKg : fr.muscu.session.kg}</span>
        <span>{fr.muscu.session.reps}</span>
        <span />
      </div>
      {children}
    </div>
  )
}

/** Accessible names of the controls of a set row. */
export interface SetRowLabels {
  weight: string
  reps: string
  validate: string
  reopen: string
}

interface SetRowProps {
  set: SessionSetDto
  /** First column: the set number (with its A / B badge in a superset). */
  index: ReactNode
  labels: SetRowLabels
  /** The set to do now: the only one with inputs (later ones are locked). */
  current: boolean
  busy: boolean
  onSave: (weight: number | null, reps: number | null, done: boolean) => Promise<boolean>
}

/** Objectif | kg | Reps | ✓ — inputs empty with the target as placeholder; ✓ on empty inputs records the target. */
export function SetRow({ set, index, labels, current, busy, onSave }: SetRowProps) {
  const [weight, setWeight] = useState(set.weight === null ? '' : formatWeight(set.weight))
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps))
  const hasTarget = set.targetWeight !== null && set.targetReps !== null
  const target = hasTarget ? `${formatWeight(set.targetWeight!)} × ${set.targetReps}` : fr.common.noValue

  const typedWeight = parseNumber(weight)
  const typedReps = parseNumber(reps)
  const value = {
    weight: typedWeight ?? set.targetWeight,
    reps: typedReps === null ? set.targetReps : Math.round(typedReps),
  }
  // Weights go in 0.5 kg steps (plates, stacks).
  const canValidate =
    value.weight !== null && value.reps !== null && Number.isInteger(value.weight * 2) && value.weight >= 0 && !busy

  if (set.done) {
    const under = set.targetReps !== null && set.reps! < set.targetReps
    return (
      <div className={`${styles.grid} ${styles.row}`}>
        <span className={styles.index}>{index}</span>
        <span className={styles.target}>{target}</span>
        <span className={styles.doneValue}>{formatWeight(set.weight!)}</span>
        <span className={`${styles.doneValue} ${set.targetReps === null ? '' : under ? styles.under : styles.met}`}>
          {set.reps}
        </span>
        <button
          type="button"
          className={styles.checkDone}
          aria-label={labels.reopen}
          disabled={busy}
          onClick={() => onSave(set.weight, set.reps, false)}
        >
          <Check />
        </button>
      </div>
    )
  }

  if (!current) {
    // Locked until the sets before it are done: its target, read-only.
    return (
      <div className={`${styles.grid} ${styles.row}`}>
        <span className={styles.index}>{index}</span>
        <span className={styles.target}>{target}</span>
        <span className={styles.locked}>{set.targetWeight === null ? '' : formatWeight(set.targetWeight)}</span>
        <span className={styles.locked}>{set.targetReps ?? ''}</span>
        <button type="button" className={styles.check} aria-label={labels.validate} disabled>
          <Check />
        </button>
      </div>
    )
  }

  return (
    <div className={`${styles.grid} ${styles.row} ${styles.currentRow}`}>
      <span className={styles.index}>{index}</span>
      <span className={styles.target}>{target}</span>
      <input
        className={styles.input}
        inputMode="decimal"
        aria-label={labels.weight}
        placeholder={set.targetWeight === null ? undefined : formatWeight(set.targetWeight)}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      <input
        className={styles.input}
        inputMode="numeric"
        aria-label={labels.reps}
        placeholder={set.targetReps === null ? undefined : String(set.targetReps)}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
      />
      <button
        type="button"
        className={styles.check}
        aria-label={labels.validate}
        disabled={!canValidate}
        onClick={() => onSave(typedWeight, typedReps === null ? null : Math.round(typedReps), true)}
      >
        <Check />
      </button>
    </div>
  )
}
