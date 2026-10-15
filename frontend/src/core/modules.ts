/**
 * The app's modules (top-bar switcher). The last one used is kept per device and opened at launch.
 */
export type ModuleId = 'food' | 'muscu' | 'finance'

export interface AppModule {
  id: ModuleId
  /** Home route of the module. */
  path: string
}

export const MODULES: AppModule[] = [
  { id: 'food', path: '/jour' },
  { id: 'muscu', path: '/muscu' },
  { id: 'finance', path: '/finances' },
]

const STORAGE_KEY = 'healthManager.module'

export function getLastModule(): ModuleId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return MODULES.some((m) => m.id === stored) ? (stored as ModuleId) : 'food'
  } catch {
    return 'food'
  }
}

export function setLastModule(id: ModuleId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Storage unavailable (private mode): launch opens Alimentation.
  }
}

/** Where launch (and any unknown path) goes: the home of the last module used. */
export const launchPath = (): string => MODULES.find((m) => m.id === getLastModule())!.path
