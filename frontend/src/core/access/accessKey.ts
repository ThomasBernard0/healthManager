/**
 * The device's access key: asked once, kept in localStorage, sent with every API call.
 * Opening /?key=… stores it on a new device.
 */
const STORAGE_KEY = 'healthManager.accessKey'

/** Fallback when localStorage is unavailable. */
let memoryKey: string | null = null

export function getAccessKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAccessKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // Storage unavailable (private mode): the key lives for this page only.
  }
  memoryKey = key
}

/** The key to send: stored one, or the one entered on this page if storage failed. */
export const currentAccessKey = (): string | null => getAccessKey() ?? memoryKey

/** Moves ?key=… from the URL into storage and removes it from the address bar. */
export function captureKeyFromUrl(location: Location = window.location): void {
  const url = new URL(location.href)
  const key = url.searchParams.get('key')
  if (!key) return
  setAccessKey(key)
  url.searchParams.delete('key')
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
}

type Listener = () => void
const listeners = new Set<Listener>()

/** Called by the HTTP layer on any 401. */
export function notifyUnauthorized(): void {
  for (const listener of listeners) listener()
}

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
