import { useEffect, useState } from 'react'
import { healthCheck } from '../api/generated/endpoints/health/health'
import styles from './Page.module.css'

type ApiState =
  | { kind: 'loading' }
  | { kind: 'ok'; status: string }
  | { kind: 'error' }

export default function HomePage() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    healthCheck()
      .then(({ status }) => !cancelled && setApi({ kind: 'ok', status }))
      .catch(() => !cancelled && setApi({ kind: 'error' }))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>healthManager</h1>
      <div className={styles.card}>
        <span className={styles.label}>API status:</span>
        {api.kind === 'loading' && (
          <span className={`${styles.status} ${styles.loading}`}>checking…</span>
        )}
        {api.kind === 'ok' && (
          <span className={`${styles.status} ${styles.ok}`} data-testid="api-status">
            {api.status}
          </span>
        )}
        {api.kind === 'error' && (
          <span className={`${styles.status} ${styles.error}`}>unreachable</span>
        )}
      </div>
    </main>
  )
}
