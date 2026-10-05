import { Link } from 'react-router-dom'
import type { WeekSummaryDto } from '../../../api/generated/model'
import { formatInt } from '../../../core/format'
import { toUtcDate } from '@healthmanager/shared'
import { fr } from '../../../i18n/fr'
import { dayPath } from '../routes'
import styles from './WeekTable.module.css'

/** Semaine on desktop: kcal, P, G, L and the gap to each day's target, with a week total row. */
export function WeekTable({ week }: { week: WeekSummaryDto }) {
  const t = fr.desktop.table
  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.dayCol}>{t.day}</th>
            <th>{t.kcal}</th>
            <th>{t.p}</th>
            <th>{t.g}</th>
            <th>{t.l}</th>
            <th>{t.gap}</th>
          </tr>
        </thead>
        <tbody>
          {week.days.map((d, i) => {
            const isToday = d.date === week.today
            const isFuture = d.date > week.today
            const label = `${fr.desktop.shortDays[i]} ${toUtcDate(d.date).getUTCDate()}`
            return (
              <tr key={d.date}>
                <td className={styles.dayCol}>
                  {d.date < week.earliestDate ? (
                    label
                  ) : (
                    <Link to={dayPath(d.date)}>
                      {label}
                      {isToday && ` · ${fr.desktop.inProgress}`}
                    </Link>
                  )}
                </td>
                <td className={styles.kcal}>{formatInt(d.eaten.kcal)}</td>
                <td>{formatInt(d.eaten.protein)}</td>
                <td>{formatInt(d.eaten.carbs)}</td>
                <td>{formatInt(d.eaten.fat)}</td>
                <td>
                  <Gap left={d.left?.kcal ?? null} remainingStyle={isToday ? 'muted' : 'signed'} hidden={isFuture} />
                </td>
              </tr>
            )
          })}
          <tr className={styles.total}>
            <td className={styles.dayCol}>{t.week}</td>
            <td>{formatInt(week.eaten.kcal)}</td>
            <td>{formatInt(week.eaten.protein)}</td>
            <td>{formatInt(week.eaten.carbs)}</td>
            <td>{formatInt(week.eaten.fat)}</td>
            <td>
              <Gap left={week.left?.kcal ?? null} remainingStyle="accent" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * Écart: over target → "dépassé de N" (over colour, words not colour alone);
 * under → "−N" for a finished day, "N restantes" for today and the week.
 */
function Gap({
  left,
  remainingStyle,
  hidden = false,
}: {
  left: number | null
  remainingStyle: 'signed' | 'muted' | 'accent'
  hidden?: boolean
}) {
  if (left === null || hidden) return <span className={styles.muted}>{fr.common.noValue}</span>
  if (left < 0) return <span className={styles.over}>{fr.over(formatInt(-left))}</span>
  if (remainingStyle === 'signed') return <span className={styles.under}>−{formatInt(left)}</span>
  return (
    <span className={remainingStyle === 'accent' ? styles.under : styles.muted}>
      {fr.desktop.remaining(formatInt(left))}
    </span>
  )
}
