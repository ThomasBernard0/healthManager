import { Link, useLocation } from 'react-router-dom'
import type { DaySummaryDto, LogEntryDto, WeekSummaryDto } from '../../../api/generated/model'
import { formatInt, formatMacros, formatQuantity } from '../../../core/format'
import { Dots, Pencil, Plus } from '../../../core/ui/icons'
import { MacroBar } from '../../../core/ui/MacroBar'
import { Ring } from '../../../core/ui/Ring'
import { fr } from '../../../i18n/fr'
import { GOAL_PATH, weekPath } from '../routes'
import styles from './DayDesktop.module.css'

interface DayDesktopProps {
  data: DaySummaryDto
  /** The week of the day, for the mini chart (loaded separately). */
  week: WeekSummaryDto | undefined
  onOpenEntry: (entry: LogEntryDto) => void
  onAdd: () => void
}

/** Jour on desktop (design/bureau-jour.html): a wide summary band above the full-width meals list. */
export function DayDesktop({ data, week, onOpenEntry, onAdd }: DayDesktopProps) {
  const location = useLocation()
  const { goal, eaten, left, entries } = data
  const overBy = left !== null && left.kcal < 0 ? -left.kcal : null

  return (
    <main className={styles.main}>
      <section className={styles.band}>
        <Ring value={eaten.kcal} target={goal?.dailyKcal ?? null} variant="desktop">
          {overBy !== null ? (
            <>
              <div className={`${styles.ringLabel} ${styles.overText}`}>{fr.day.overBy}</div>
              <div className={`${styles.ringValue} ${styles.overText}`}>{formatInt(overBy)}</div>
              <div className={styles.ringLabel}>{fr.common.kcal}</div>
            </>
          ) : (
            <>
              <div className={styles.ringValue}>{left ? formatInt(left.kcal) : fr.common.noValue}</div>
              <div className={styles.ringLabel}>{fr.day.kcalLeft}</div>
            </>
          )}
        </Ring>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{fr.day.eaten}</div>
            <div className={styles.eaten}>{formatInt(eaten.kcal)}</div>
          </div>
          <Link
            to={GOAL_PATH}
            state={{ background: location }}
            className={styles.stat}
            aria-label={fr.day.editDailyGoal}
          >
            <div className={styles.statLabel}>
              {fr.day.dailyGoal} <Pencil className={styles.pencil} />
            </div>
            <div className={styles.goal}>{goal ? formatInt(goal.dailyKcal) : fr.common.noValue}</div>
          </Link>
        </div>

        <div className={styles.macros}>
          <MacroBar variant="inline" macro="protein" eaten={eaten.protein} target={goal?.protein ?? null} />
          <MacroBar variant="inline" macro="carbs" eaten={eaten.carbs} target={goal?.carbs ?? null} />
          <MacroBar variant="inline" macro="fat" eaten={eaten.fat} target={goal?.fat ?? null} />
        </div>

        <MiniWeek data={data} week={week} />
      </section>

      <section className={styles.meals}>
        <div className={styles.mealsHeader}>
          <h2 className={styles.mealsTitle}>{fr.day.meals}</h2>
          <div className={styles.mealsActions}>
            <span className={styles.mealsMeta}>
              {formatInt(eaten.kcal)} {fr.common.kcal} · {formatMacros(eaten)}
            </span>
            <button type="button" className={styles.add} onClick={onAdd}>
              <Plus size={18} />
              {fr.day.add}
            </button>
          </div>
        </div>
        {entries.map((entry) => (
          <div key={entry.id} className={styles.row}>
            <span className={styles.time}>{entry.time}</span>
            <button type="button" className={styles.name} onClick={() => onOpenEntry(entry)}>
              {entry.label}
              {entry.quantity !== 1 && <span className={styles.quantity}> {formatQuantity(entry.quantity)}</span>}
            </button>
            <span className={styles.macro}>
              {fr.macros.p} {formatInt(entry.total.protein)}
            </span>
            <span className={styles.macro}>
              {fr.macros.g} {formatInt(entry.total.carbs)}
            </span>
            <span className={styles.macro}>
              {fr.macros.l} {formatInt(entry.total.fat)}
            </span>
            <span className={styles.kcal}>{formatInt(entry.total.kcal)}</span>
            <button
              type="button"
              className={styles.menu}
              aria-label={fr.desktop.options(entry.label)}
              onClick={() => onOpenEntry(entry)}
            >
              <Dots />
            </button>
          </div>
        ))}
      </section>
    </main>
  )
}

/** Right end of the band: the week so far (opens Semaine). */
function MiniWeek({ data, week }: { data: DaySummaryDto; week: WeekSummaryDto | undefined }) {
  const { eaten, target, left } = data.week
  const over = left !== null && left.kcal < 0
  const days = week?.days ?? []
  const max = Math.max(1, ...days.flatMap((d) => [d.eaten.kcal, d.target?.kcal ?? 0]))

  return (
    <Link to={weekPath(data.week.monday)} className={styles.week} aria-label={fr.desktop.seeWeek}>
      <div className={styles.weekHead}>
        <span className={styles.statLabel}>{fr.day.week}</span>
        {left && (
          <span className={over ? styles.weekOver : styles.weekLeft}>
            {over ? fr.over(formatInt(-left.kcal)) : fr.desktop.remaining(formatInt(left.kcal))}
          </span>
        )}
      </div>
      <div className={styles.weekValue}>
        {formatInt(eaten.kcal)}{' '}
        <span className={styles.weekTarget}>/ {target ? formatInt(target.kcal) : fr.common.noValue}</span>
      </div>
      <div className={styles.miniChart} aria-hidden="true">
        {days.map((d, i) => {
          const isOver = d.left !== null && d.left.kcal < 0
          const isToday = d.date === data.today
          const cls = isOver ? styles.miniOver : isToday ? styles.miniCurrent : styles.miniBar
          return (
            <div key={d.date} className={styles.miniDay}>
              <div className={cls} style={{ height: `${(d.eaten.kcal / max) * 100}%` }} />
              <span className={isToday ? styles.miniTodayLabel : styles.miniLabel}>{fr.week.initials[i]}</span>
            </div>
          )
        })}
      </div>
    </Link>
  )
}
