import type { WeekDayDto } from '../../../api/generated/model'
import { formatInt, formatShortDay } from '../../../core/format'
import { fr } from '../../../i18n/fr'
import styles from './WeekChart.module.css'

interface WeekChartProps {
  days: WeekDayDto[]
  today: string
  onOpenDay: (date: string) => void
}

/** Bar per day against that day's target (dashed); over target = over colour + "dépassé de N". */
export function WeekChart({ days, today, onOpenDay }: WeekChartProps) {
  const max = Math.max(1, ...days.flatMap((d) => [d.eaten.kcal, d.target?.kcal ?? 0])) * 1.12
  const pct = (kcal: number) => `${(kcal / max) * 100}%`
  const overDays = days.filter((d) => d.left && d.left.kcal < 0)

  return (
    <section className={styles.card}>
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
              aria-label={fr.week.openDay(formatShortDay(d.date), formatInt(d.eaten.kcal))}
              onClick={() => onOpenDay(d.date)}
            >
              {d.eaten.kcal > 0 && <span className={cls} style={{ height: pct(d.eaten.kcal) }} />}
            </button>
          )
        })}
      </div>
      <div className={styles.labels} aria-hidden="true">
        {days.map((d, i) => (
          <span key={d.date} className={d.date === today ? styles.todayLabel : undefined}>
            {fr.week.initials[i]}
          </span>
        ))}
      </div>
      {overDays.length > 0 && (
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
