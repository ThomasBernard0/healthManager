import type { WeekDayDto } from '../../../api/generated/model'
import { formatInt, formatShortDay } from '../../../core/format'
import { fr } from '../../../i18n/fr'
import styles from './WeekChart.module.css'

interface WeekChartProps {
  days: WeekDayDto[]
  today: string
  /** Days before it (the first day with data) can't be opened. */
  earliest: string
  onOpenDay: (date: string) => void
  /** desktop: taller, value above each bar, "Lun…Dim" labels (the table beside it says "dépassé de"). */
  variant?: 'mobile' | 'desktop'
}

/** Bar per day against that day's target (dashed); over target = over colour + "dépassé de N". */
export function WeekChart({ days, today, earliest, onOpenDay, variant = 'mobile' }: WeekChartProps) {
  const desktop = variant === 'desktop'
  const max = Math.max(1, ...days.flatMap((d) => [d.eaten.kcal, d.target?.kcal ?? 0])) * (desktop ? 1.2 : 1.12)
  const pct = (kcal: number) => `${(kcal / max) * 100}%`
  const overDays = days.filter((d) => d.left && d.left.kcal < 0)
  const labels = desktop ? fr.desktop.shortDays : fr.week.initials

  return (
    <section className={`${styles.card} ${desktop ? styles.desktop : ''}`}>
      <h2 className={styles.title}>{fr.week.perDay}</h2>
      <div className={styles.chart}>
        <svg className={styles.targets} viewBox="0 0 700 100" preserveAspectRatio="none" aria-hidden="true">
          {days.map((d, i) =>
            d.target ? (
              <line
                key={d.date}
                x1={i * 100}
                x2={(i + 1) * 100}
                y1={100 - (d.target.kcal / max) * 100}
                y2={100 - (d.target.kcal / max) * 100}
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
        </svg>
        {days.map((d) => {
          const over = d.left !== null && d.left.kcal < 0
          const cls = over ? styles.over : d.date === today ? styles.current : styles.bar
          return (
            <button
              key={d.date}
              type="button"
              className={styles.column}
              disabled={d.date < earliest}
              aria-label={fr.week.openDay(formatShortDay(d.date), formatInt(d.eaten.kcal))}
              onClick={() => onOpenDay(d.date)}
            >
              <span className={styles.stack} style={{ height: pct(d.eaten.kcal) }}>
                {desktop && d.eaten.kcal > 0 && (
                  <span className={over ? styles.valueOver : styles.value}>{formatInt(d.eaten.kcal)}</span>
                )}
                {d.eaten.kcal > 0 && <span className={cls} />}
              </span>
            </button>
          )
        })}
      </div>
      <div className={styles.labels} aria-hidden="true">
        {days.map((d, i) => (
          <span key={d.date} className={d.date === today ? styles.todayLabel : undefined}>
            {labels[i]}
          </span>
        ))}
      </div>
      {!desktop && overDays.length > 0 && (
        <ul className={styles.overList}>
          {overDays.map((d) => (
            <li key={d.date}>
              {formatShortDay(d.date)} · {fr.over(formatInt(-(d.left?.kcal ?? 0)))}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
