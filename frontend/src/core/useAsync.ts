import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'ok'; data: T }
  | { status: 'error'; data?: T; error: unknown }

interface Result<T> {
  key: string
  ok: boolean
  data?: T
  error?: unknown
}

/**
 * Runs `load` whenever `key` changes; `reload()` runs it again in place
 * (the previous data stays available while it loads).
 */
export function useAsync<T>(load: () => Promise<T>, key: string): AsyncState<T> & { reload: () => void } {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  const loadRef = useRef(load)
  const requestKey = `${key}#${version}`

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let cancelled = false
    loadRef.current().then(
      (data) => {
        if (!cancelled) setResult({ key: requestKey, ok: true, data })
      },
      (error: unknown) => {
        if (!cancelled) setResult((r) => ({ key: requestKey, ok: false, data: r?.data, error }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [requestKey])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  if (!result || result.key !== requestKey) return { status: 'loading', data: result?.data, reload }
  if (result.ok) return { status: 'ok', data: result.data as T, reload }
  return { status: 'error', data: result.data, error: result.error, reload }
}
