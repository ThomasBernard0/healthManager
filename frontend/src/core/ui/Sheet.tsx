import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fr } from '../../i18n/fr'
import { ChevronLeft, Close } from './icons'
import styles from './Sheet.module.css'

interface SheetProps {
  title: string
  onClose: () => void
  /** The back arrow's action (defaults to onClose). */
  onBack?: () => void
  /** "back" shows a back arrow on the left, "close" an X on the right. */
  dismiss?: 'back' | 'close'
  children: ReactNode
}

/** Bottom sheet on mobile, centred dialog on desktop (≥ 1024 px). */
export function Sheet({ title, onClose, onBack, dismiss = 'close', children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLElement>('input, button:not([data-dismiss])')
    ;(first ?? panel.current)?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  const dismissButton = (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={dismiss === 'back' ? fr.common.back : fr.common.close}
      onClick={dismiss === 'back' ? (onBack ?? onClose) : onClose}
      data-dismiss
    >
      {dismiss === 'back' ? <ChevronLeft /> : <Close />}
    </button>
  )

  return createPortal(
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onClose} />
      <div
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          {dismiss === 'back' ? (
            <>
              {dismissButton}
              <h2 className={styles.titleCentered}>{title}</h2>
              <span className={styles.spacer} />
            </>
          ) : (
            <>
              <h2 className={styles.title}>{title}</h2>
              {dismissButton}
            </>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
