import { useEffect, useState } from 'react'
import { exercisesImage } from '../../api/generated/endpoints/exercises/exercises'

export interface LoadedImage {
  /** Object URL of the picture. */
  url: string
  /** Line-art drawing (SVG): tinted with the theme ink instead of shown as is. */
  isDrawing: boolean
}

// Pictures go through the API client (it carries the access key) and are kept for the session.
const loaded = new Map<string, LoadedImage>()
const pending = new Map<string, Promise<void>>()

function load(exerciseId: string, imageVersion: string, key: string): Promise<void> {
  let request = pending.get(key)
  if (!request) {
    request = exercisesImage(exerciseId, { v: imageVersion }).then((blob) => {
      loaded.set(key, { url: URL.createObjectURL(blob), isDrawing: blob.type === 'image/svg+xml' })
    })
    request.catch(() => pending.delete(key))
    pending.set(key, request)
  }
  return request
}

/** The exercise's picture, once loaded (null: none, or not there yet). */
export function useExerciseImage(exerciseId: string, imageVersion: string | null): LoadedImage | null {
  const key = imageVersion === null ? null : `${exerciseId}:${imageVersion}`
  const [, setLoads] = useState(0)

  useEffect(() => {
    if (key === null || imageVersion === null || loaded.has(key)) return
    let cancelled = false
    load(exerciseId, imageVersion, key).then(
      () => {
        if (!cancelled) setLoads((n) => n + 1)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [exerciseId, imageVersion, key])

  return key === null ? null : (loaded.get(key) ?? null)
}
