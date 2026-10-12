import type { ExerciseDto } from '../../../api/generated/model'
import { useExerciseImage, type LoadedImage } from '../useExerciseImage'
import styles from './ExerciseImage.module.css'

interface ImageFrameProps {
  image: LoadedImage | null
  className?: string
}

/**
 * A picture in its tile (empty tile without one). A line-art drawing is tinted with the theme ink (the SVG
 * is used as a CSS mask, so the lines are dark on light and light on dark); a photo fills the tile.
 * Decorative: the name is always next to it.
 */
export function ImageFrame({ image, className = '' }: ImageFrameProps) {
  return (
    <span className={`${styles.frame} ${className}`} aria-hidden="true">
      {image?.isDrawing && (
        <span
          className={styles.lines}
          style={{ maskImage: `url("${image.url}")`, WebkitMaskImage: `url("${image.url}")` }}
        />
      )}
      {image && !image.isDrawing && <img className={styles.photo} src={image.url} alt="" />}
    </span>
  )
}

interface ExerciseImageProps {
  exercise: Pick<ExerciseDto, 'id' | 'imageVersion'>
  className?: string
}

/** The exercise's picture, loaded from the API. */
export function ExerciseImage({ exercise, className }: ExerciseImageProps) {
  return <ImageFrame image={useExerciseImage(exercise.id, exercise.imageVersion)} className={className} />
}
