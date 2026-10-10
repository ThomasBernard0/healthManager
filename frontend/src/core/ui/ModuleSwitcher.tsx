import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fr } from '../../i18n/fr'
import { MODULES, setLastModule, type ModuleId } from '../modules'
import { Check, ChevronDown } from './icons'
import styles from './ModuleSwitcher.module.css'

interface ModuleSwitcherProps {
  current: ModuleId
  /** Desktop top bar: larger title. */
  variant?: 'mobile' | 'desktop'
}

/** Module title + chevron; opens a small menu listing the modules. */
export function ModuleSwitcher({ current, variant = 'mobile' }: ModuleSwitcherProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // Every module home shows the switcher: showing it is what marks the module as last used.
  useEffect(() => setLastModule(current), [current])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className={`${styles.root} ${variant === 'desktop' ? styles.desktop : ''}`}>
      <button
        type="button"
        className={styles.button}
        aria-label={`${fr.modules[current]} – ${fr.modules.switch}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {fr.modules[current]}
        <ChevronDown size={variant === 'desktop' ? 18 : 16} />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {MODULES.map((m) => (
            <Link
              key={m.id}
              to={m.path}
              role="menuitem"
              className={styles.item}
              aria-current={m.id === current ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <span>{fr.modules[m.id]}</span>
              {m.id === current && <Check size={16} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
