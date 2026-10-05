import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './ModalFrame.module.css'

/**
 * A route shown over the page it was opened from (location.state.background):
 * full screen on mobile, a centred dialog (max 560 px) on desktop. Escape or the scrim go back.
 */
export function ModalFrame({ label, children }: { label: string; children: ReactNode }) {
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Sheets opened inside the dialog handle their own Escape.
      if (e.key === 'Escape' && !document.querySelector('[data-sheet]')) navigate(-1)
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [navigate])

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={() => navigate(-1)} />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  )
}
