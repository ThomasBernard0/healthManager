import { ExerciseDrawing } from './ExerciseDrawing'
import styles from './ExerciseThumb.module.css'

interface ExerciseThumbProps {
  imageUrl: string | null
  size?: 'sm' | 'md' | 'lg'
}

/** Square thumbnail of an exercise (empty tile without a drawing). */
export function ExerciseThumb({ imageUrl, size = 'md' }: ExerciseThumbProps) {
  return <ExerciseDrawing imageUrl={imageUrl} className={`${styles.thumb} ${size === 'md' ? '' : styles[size]}`} />
}
