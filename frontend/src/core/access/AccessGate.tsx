import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { accessCheck } from '../../api/generated/endpoints/access/access'
import { fr } from '../../i18n/fr'
import form from '../ui/form.module.css'
import { captureKeyFromUrl, currentAccessKey, onUnauthorized, setAccessKey } from './accessKey'
import styles from './AccessGate.module.css'

/**
 * Asks for the access key once per device (or after any 401), then renders the app.
 * The children remount after a new key so every screen reloads its data.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const [needsKey, setNeedsKey] = useState(() => {
    captureKeyFromUrl()
    return !currentAccessKey()
  })
  const [session, setSession] = useState(0)

  useEffect(() => onUnauthorized(() => setNeedsKey(true)), [])

  if (needsKey) {
    return (
      <KeyPrompt
        onAccepted={() => {
          setNeedsKey(false)
          setSession((s) => s + 1)
        }}
      />
    )
  }
  return <div key={session}>{children}</div>
}

function KeyPrompt({ onAccepted }: { onAccepted: () => void }) {
  const [key, setKey] = useState('')
  const [state, setState] = useState<'idle' | 'checking' | 'wrong'>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = key.trim()
    if (!value) return
    setState('checking')
    setAccessKey(value)
    try {
      await accessCheck()
      onAccepted()
    } catch {
      setState('wrong')
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={submit}>
        <h1 className={styles.title}>{fr.app.title}</h1>
        <label className={form.field}>
          {fr.access.label}
          <input
            className={form.input}
            type="password"
            autoComplete="current-password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value)
              setState('idle')
            }}
            autoFocus
          />
        </label>
        {state === 'wrong' && (
          <div className={form.error} role="alert">
            {fr.access.wrong}
          </div>
        )}
        <button className={form.primary} type="submit" disabled={!key.trim() || state === 'checking'}>
          {fr.access.submit}
        </button>
      </form>
    </main>
  )
}
