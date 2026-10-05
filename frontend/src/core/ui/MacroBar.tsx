import { formatInt } from '../format'
import { fr } from '../../i18n/fr'
import styles from './MacroBar.module.css'

export type Macro = 'protein' | 'carbs' | 'fat'

interface MacroBarProps {
  macro: Macro
  eaten: number
  target: number | null
  /** "stacked" (mobile): label, bar, value. "inline" (desktop): label and value on one row, then the bar. */
  variant?: 'stacked' | 'inline'
}

/** "Protéines", a bar, "88 / 150 g" — and "dépassé de N g" in the over colour past the target. */
export function MacroBar({ macro, eaten, target, variant = 'stacked' }: MacroBarProps) {
  const over = target !== null && Math.round(eaten) > Math.round(target)
  const percent = target && target > 0 ? Math.min((eaten / target) * 100, 100) : 0
  const unit = fr.common.grams

  const label = <div className={styles.label}>{fr.macros[macro]}</div>
  const value = (
    <div className={styles.value}>
      {formatInt(eaten)} / {target === null ? fr.common.noValue : formatInt(target)} {unit}
    </div>
  )
  const track = (
    <div className={styles.track}>
      <div className={`${styles.fill} ${over ? styles.fillOver : styles[macro]}`} style={{ width: `${percent}%` }} />
    </div>
  )

  return (
    <div className={`${styles.macro} ${variant === 'inline' ? styles.inline : ''}`}>
      {variant === 'inline' ? (
        <>
          <div className={styles.row}>
            {label}
            {value}
          </div>
          {track}
        </>
      ) : (
        <>
          {label}
          {track}
          {value}
        </>
      )}
      {over && target !== null && (
        <div className={styles.over}>{fr.over(`${formatInt(eaten - target)} ${unit}`)}</div>
      )}
    </div>
  )
}
