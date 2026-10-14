import { useSyncExternalStore } from 'react'
import { exercisesImage } from '../../../api/generated/endpoints/exercises/exercises'
import { sessionsBundle } from '../../../api/generated/endpoints/sessions/sessions'
import type { SessionBundleDto } from '../../../api/generated/model'
import { idbDelete, idbGet, idbSet } from './idb'
import { fromBundle, type LocalSession } from './localSession'

// One session in progress per device. Its pictures are kept apart, so a change rewrites only the session.
const SESSION_KEY = 'session'
const IMAGES_KEY = 'images'

/** The pictures of the session's exercises, by exercise id (`version`: its imageVersion). */
export type StoredImages = Record<string, { version: string; blob: Blob }>

/** undefined: not read from the device yet; null: no session in progress here. */
let current: LocalSession | null | undefined
let reading: Promise<LocalSession | null> | null = null
const listeners = new Set<() => void>()

function publish(session: LocalSession | null) {
  current = session
  for (const listener of listeners) listener()
}

/** The local copy, read from IndexedDB once. */
export function readLocalSession(): Promise<LocalSession | null> {
  if (current !== undefined) return Promise.resolve(current)
  reading ??= idbGet<LocalSession>(SESSION_KEY)
    .catch(() => undefined)
    .then((stored) => {
      if (current === undefined) publish(stored ?? null)
      return current ?? null
    })
  return reading
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  void readLocalSession()
  return () => listeners.delete(listener)
}

/** The session in progress on this device (undefined while it is read). */
export function useLocalSession(): LocalSession | null | undefined {
  return useSyncExternalStore(subscribe, () => current)
}

/** Every change is written to the device before it is shown as saved. */
export async function saveLocalSession(session: LocalSession): Promise<void> {
  await idbSet(SESSION_KEY, session)
  publish(session)
}

/** After Terminer or Quitter: nothing left on the device. */
export async function clearLocalSession(): Promise<void> {
  await Promise.all([idbDelete(SESSION_KEY), idbDelete(IMAGES_KEY)])
  imageUrls.clear()
  publish(null)
}

export const readStoredImages = (): Promise<StoredImages> => idbGet<StoredImages>(IMAGES_KEY).then((i) => i ?? {})

/**
 * Keeps a session bundle on the device with the pictures of its exercises (downloaded now, through the API
 * client as useExerciseImage does), so the session runs without the network.
 */
export async function storeBundle(bundle: SessionBundleDto): Promise<LocalSession> {
  const images: StoredImages = {}
  await Promise.all(
    bundle.exercises.map(async ({ exercise }) => {
      if (exercise.imageVersion === null || images[exercise.id]) return
      // A picture that fails to load is only missing from the session, which still starts.
      const blob = await exercisesImage(exercise.id, { v: exercise.imageVersion }).catch(() => null)
      if (blob) images[exercise.id] = { version: exercise.imageVersion, blob }
    }),
  )
  // Best effort: asks the browser not to clear the local copy when space runs low.
  void navigator.storage?.persist?.().catch(() => false)
  await idbSet(IMAGES_KEY, images)
  const session = fromBundle(bundle)
  await saveLocalSession(session)
  return session
}

// Object URLs of the stored pictures, made once per exercise.
const imageUrls = new Map<string, { version: string; url: string; isDrawing: boolean }>()

/** The stored pictures as object URLs, by exercise id. */
export async function storedImageUrls(): Promise<Map<string, { version: string; url: string; isDrawing: boolean }>> {
  const stored = await readStoredImages()
  for (const [id, { version, blob }] of Object.entries(stored)) {
    if (imageUrls.get(id)?.version === version) continue
    imageUrls.set(id, { version, url: URL.createObjectURL(blob), isDrawing: blob.type === 'image/svg+xml' })
  }
  return imageUrls
}

/** Tests: forget what was read (the next read goes to IndexedDB again). */
export function resetLocalSessionCache(): void {
  current = undefined
  reading = null
  imageUrls.clear()
}

/** Applies a change to the session in progress and writes it to the device. */
export async function updateLocalSession(change: (session: LocalSession) => LocalSession): Promise<void> {
  const session = await readLocalSession()
  if (!session) throw new Error('No session in progress on this device')
  await saveLocalSession(change(session))
}

/** A session in progress on the server but not on this device: its bundle, kept here (needs the connection). */
export const resumeSession = async (id: string): Promise<LocalSession> => storeBundle(await sessionsBundle(id))
