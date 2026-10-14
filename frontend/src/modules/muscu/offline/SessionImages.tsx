import { useEffect, useState, type ReactNode } from 'react'
import { LocalImages, type LoadedImage } from '../useExerciseImage'
import { storedImageUrls } from './store'

/** The session screens show the pictures stored with the session, never fetched. */
export function SessionImages({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<ReadonlyMap<string, LoadedImage>>(() => new Map())

  useEffect(() => {
    let cancelled = false
    storedImageUrls().then(
      (urls) => {
        if (!cancelled) setImages(new Map(urls))
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [])

  return <LocalImages.Provider value={images}>{children}</LocalImages.Provider>
}
