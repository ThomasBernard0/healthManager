import styles from './ExerciseDrawing.module.css'

interface ExerciseDrawingProps {
  imageUrl: string | null
  className?: string
}

/**
 * The exercise's line-art drawing, tinted with the theme ink (the SVG is used as a CSS mask, so the
 * lines are dark on light and light on dark). Decorative: the name is always next to it.
 */
export function ExerciseDrawing({ imageUrl, className = '' }: ExerciseDrawingProps) {
  return (
    <span className={`${styles.frame} ${className}`} aria-hidden="true">
      {imageUrl && (
        <span
          className={styles.lines}
          style={{ maskImage: `url("${imageUrl}")`, WebkitMaskImage: `url("${imageUrl}")` }}
        />
      )}
    </span>
  )
}
