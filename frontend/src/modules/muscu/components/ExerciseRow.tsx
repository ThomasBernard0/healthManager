import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ExerciseDto } from '../../../api/generated/model'
import { exerciseSubtitle } from '../format'
import { exercisePath } from '../routes'
import { ExerciseThumb } from './ExerciseThumb'
import styles from './ExerciseRow.module.css'

interface ExerciseRowProps {
  exercise: ExerciseDto
  /** Opens the Fiche exercice (not while picking for a workout). */
  link: boolean
  /** At the end of the row (picking: "+" or the workout name). */
  action?: ReactNode
}

/** An exercise in a list: thumbnail, name, muscles · equipment. Render it as a list item. */
export function ExerciseRow({ exercise, link, action }: ExerciseRowProps) {
  const content = (
    <>
      <ExerciseThumb imageUrl={exercise.imageUrl} />
      <span className={styles.text}>
        <span className={styles.name}>{exercise.name}</span>
        <span className={styles.meta}>{exerciseSubtitle(exercise)}</span>
      </span>
    </>
  )
  return (
    <li className={styles.item}>
      {link ? (
        <Link to={exercisePath(exercise.id)} className={styles.row}>
          {content}
        </Link>
      ) : (
        <span className={styles.row}>{content}</span>
      )}
      {action && <span className={styles.action}>{action}</span>}
    </li>
  )
}
