import type { ExerciseDto } from '../../../api/generated/model'
import { ExerciseImage } from './ExerciseImage'
import styles from './ExerciseThumb.module.css'

interface ExerciseThumbProps {
  exercise: Pick<ExerciseDto, 'id' | 'imageVersion'>
  size?: 'sm' | 'md' | 'lg'
}

/** Square thumbnail of an exercise (empty tile without a picture). */
export function ExerciseThumb({ exercise, size = 'md' }: ExerciseThumbProps) {
  return <ExerciseImage exercise={exercise} className={`${styles.thumb} ${size === 'md' ? '' : styles[size]}`} />
}
