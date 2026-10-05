import { useSyncExternalStore } from 'react'

// A counter bumped after any change made in a dialog (goal saved, meal saved…), so pages that
// stay mounted underneath reload their data. Pages put it in their useAsync key.
let version = 0
const listeners = new Set<() => void>()

export function invalidateData(): void {
  version++
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version)
}
