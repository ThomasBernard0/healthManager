import type { FinanceCategory } from '@healthmanager/shared'
import styles from './CategorySquare.module.css'

/** The colour square of a category (section header, pill, legend); "rest" is the Reste row of the legend. */
export function CategorySquare({ category, small }: { category: FinanceCategory | 'rest'; small?: boolean }) {
  return <span className={`${styles.square} ${small ? styles.small : ''} ${styles[category]}`} aria-hidden="true" />
}
