import { normalizeBarcode } from '@healthmanager/shared'
import { useEffect, useRef, useState } from 'react'
import { fr } from '../../../i18n/fr'
import { createDetector, type Detector } from './detector'
import styles from './BarcodeCamera.module.css'

/** Time between two reads of the video frame. */
const SCAN_INTERVAL_MS = 200

interface BarcodeCameraProps {
  /** A valid EAN/UPC code was read (digits only). */
  onDetected: (code: string) => void
  /** Stop reading while the scanned code is looked up. */
  paused: boolean
}

/** Back camera preview that reads food barcodes continuously. */
export function BarcodeCamera({ onDetected, paused }: BarcodeCameraProps) {
  const video = useRef<HTMLVideoElement>(null)
  const [unavailable, setUnavailable] = useState(false)
  const onDetectedRef = useRef(onDetected)
  const pausedRef = useRef(paused)

  useEffect(() => {
    onDetectedRef.current = onDetected
    pausedRef.current = paused
  })

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('No camera API')
      const [media, detector] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
        createDetector(),
      ])
      stream = media
      const el = video.current
      if (cancelled || !el) return
      el.srcObject = media
      await el.play()
      scan(detector)
    }

    function scan(detector: Detector) {
      timer = setTimeout(async () => {
        const el = video.current
        if (cancelled || !el) return
        if (!pausedRef.current && el.readyState >= el.HAVE_CURRENT_DATA) {
          try {
            const codes = await detector.detect(el)
            const code = codes.map((c) => normalizeBarcode(c.rawValue)).find((c) => c !== null)
            if (code && !cancelled && !pausedRef.current) {
              navigator.vibrate?.(50)
              onDetectedRef.current(code)
            }
          } catch {
            // A frame that can't be read: try the next one.
          }
        }
        scan(detector)
      }, SCAN_INTERVAL_MS)
    }

    start().catch(() => {
      if (!cancelled) setUnavailable(true)
    })

    return () => {
      cancelled = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className={styles.viewport}>
      {unavailable ? (
        <div className={styles.unavailable} role="alert">
          {fr.scan.cameraUnavailable}
        </div>
      ) : (
        <>
          <video ref={video} className={styles.video} muted playsInline aria-label={fr.scan.camera} />
          <span className={styles.frame} aria-hidden="true" />
        </>
      )}
    </div>
  )
}
