import { Link, useLocation } from 'react-router-dom'
import styles from './Page.module.css'

export default function NotFoundPage() {
  const { pathname } = useLocation()

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.label}>
        Nothing lives at <code>{pathname}</code>. <Link to="/">Back home</Link>
      </p>
    </main>
  )
}
