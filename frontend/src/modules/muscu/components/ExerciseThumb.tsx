import { ExerciseDrawing } from './ExerciseDrawing'
import styles from './ExerciseThumb.module.css'

interface ExerciseThumbProps {
  imageUrl: string | null
  size?: 'md' | 'sm'
}

/** Square thumbnail of an exercise (empty tile without a drawing). */
export function ExerciseThumb({ imageUrl, size = 'md' }: ExerciseThumbProps) {
  return <ExerciseDrawing imageUrl={imageUrl} className={`${styles.thumb} ${size === 'sm' ? styles.sm : ''}`} />
}
