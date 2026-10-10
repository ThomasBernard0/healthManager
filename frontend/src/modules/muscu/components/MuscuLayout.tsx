import type { ReactNode } from 'react'
import { ModuleSwitcher } from '../../../core/ui/ModuleSwitcher'
import { useIsDesktop } from '../../../core/useIsDesktop'
import styles from './MuscuLayout.module.css'

interface MuscuLayoutProps {
  /** narrow: one centred column (max 560 px); wide: desktop content width. */
  width?: 'narrow' | 'wide'
  children: ReactNode
}

/** Musculation page shell: on desktop, the top bar (module switcher) above the page. */
export function MuscuLayout({ width = 'narrow', children }: MuscuLayoutProps) {
  const desktop = useIsDesktop()
  const page = <div className={`${styles.page} ${desktop && width === 'wide' ? styles.wide : ''}`}>{children}</div>
  if (!desktop) return page
  return (
    <div className={styles.desktop}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <ModuleSwitcher current="muscu" variant="desktop" />
        </div>
      </header>
      {page}
    </div>
  )
}
