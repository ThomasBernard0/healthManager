import { useState, type ReactNode } from 'react'
import { Sheet } from '../../../core/ui/Sheet'
import { Stepper } from '../../../core/ui/Stepper'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import styles from './WorkoutItemSheet.module.css'

/** Same bounds as the API (SaveWorkoutItemDto). */
const MAX_SETS = 10
const MAX_REPS = 100

export interface ItemSettings {
  sets: number
  repMin: number
  repMax: number
}

interface WorkoutItemSheetProps {
  name: string
  value: ItemSettings
  onApply: (value: ItemSettings) => void
  onRemove: () => void
  onClose: () => void
}

/** The "4 × 8–12" chip of Modifier la séance: sets and rep range of one exercise (or remove it). */
export function WorkoutItemSheet({ name, value, onApply, onRemove, onClose }: WorkoutItemSheetProps) {
  const [draft, setDraft] = useState(value)
  const { workout } = fr.muscu

  return (
    <Sheet title={name} onClose={onClose} focusFirst={false}>
      <Row label={workout.sets}>
        <Stepper
          value={draft.sets}
          onChange={(sets) => setDraft((d) => ({ ...d, sets }))}
          step={1}
          min={1}
          max={MAX_SETS}
          decreaseLabel={workout.less(workout.sets)}
          increaseLabel={workout.more(workout.sets)}
        >
          {draft.sets}
        </Stepper>
      </Row>
      <Row label={workout.repMin}>
        <Stepper
          value={draft.repMin}
          // Raising the minimum above the maximum pushes the maximum up.
          onChange={(repMin) => setDraft((d) => ({ ...d, repMin, repMax: Math.max(d.repMax, repMin) }))}
          step={1}
          min={1}
          max={MAX_REPS}
          decreaseLabel={workout.less(workout.repMin)}
          increaseLabel={workout.more(workout.repMin)}
        >
          {draft.repMin}
        </Stepper>
      </Row>
      <Row label={workout.repMax}>
        <Stepper
          value={draft.repMax}
          onChange={(repMax) => setDraft((d) => ({ ...d, repMax }))}
          step={1}
          min={draft.repMin}
          max={MAX_REPS}
          decreaseLabel={workout.less(workout.repMax)}
          increaseLabel={workout.more(workout.repMax)}
        >
          {draft.repMax}
        </Stepper>
      </Row>
      <div className={styles.actions}>
        <button type="button" className={form.danger} onClick={onRemove}>
          {workout.remove}
        </button>
        <button type="button" className={`${form.primary} ${styles.ok}`} onClick={() => onApply(draft)}>
          {workout.done}
        </button>
      </div>
    </Sheet>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.stepper}>{children}</div>
    </div>
  )
}
