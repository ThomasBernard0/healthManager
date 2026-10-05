import { useSyncExternalStore } from 'react'
import { DESKTOP_MIN_WIDTH } from '../theme'

const QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

const snapshot = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false)

/** True at ≥ 1024 px: same routes and data, desktop layout. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
