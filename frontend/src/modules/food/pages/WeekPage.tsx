import { addDays, isIsoDate, parisToday, weekStart } from '@healthmanager/shared'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { summaryWeek } from '../../../api/generated/endpoints/summary/summary'
import type { WeekSummaryDto } from '../../../api/generated/model'
import { formatInt, formatWeekRange, formatWeekTitle } from '../../../core/format'
import { ChevronLeft, ChevronRight, Pencil } from '../../../core/ui/icons'
import { Ring } from '../../../core/ui/Ring'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { ViewToggle } from '../components/ViewToggle'
import { WeekChart } from '../components/WeekChart'
import { dayPath, GOAL_PATH, weekPath } from '../routes'
import styles from './WeekPage.module.css'

/** Semaine: the week Monday → Sunday (Europe/Paris), never a rolling 7 days. */
export default function WeekPage() {
  const { monday: param } = useParams()
  if (param !== undefined && !isIsoDate(param)) return <Navigate to={weekPath()} replace />
  const monday = weekStart(param ?? parisToday())
  if (param !== undefined && param !== monday) return <Navigate to={weekPath(monday)} replace />
  return <Week monday={monday} />
}

function Week({ monday }: { monday: string }) {
  const navigate = useNavigate()
  const summary = useAsync(() => summaryWeek(monday), monday)
  const data = summary.data?.monday === monday ? summary.data : undefined
  const today = data?.today ?? parisToday()
  const thisMonday = weekStart(today)
  // Jour shows today in the current week, else the Monday of the week viewed.
  const dayTarget = monday === thisMonday ? today : monday

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.switcher}>
          <button
            type="button"
            className={styles.arrow}
            aria-label={fr.week.previous}
            onClick={() => navigate(weekPath(addDays(monday, -7)))}
          >
            <ChevronLeft size={18} />
          </button>
          <div className={styles.dateBlock}>
            <h1 className={styles.weekTitle}>{formatWeekTitle(monday, thisMonday)}</h1>
            <div className={styles.dateSub}>{formatWeekRange(monday)}</div>
          </div>
          <button
            type="button"
            className={styles.arrow}
            aria-label={fr.week.next}
            onClick={() => navigate(weekPath(addDays(monday, 7)))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <ViewToggle dayTo={dayPath(dayTarget)} weekTo={weekPath(monday)} />
      </header>

      {summary.status === 'error' && !data && (
        <div className={styles.card} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={summary.reload}>
            {fr.common.retry}
          </button>
        </div>
      )}

      {data && (
        <>
          <WeekRingCard data={data} isCurrent={monday === thisMonday} />
          <WeekChart days={data.days} today={today} onOpenDay={(date) => navigate(dayPath(date))} />
          <div className={styles.tiles}>
            <Tile label={fr.week.averageKcal} value={`${formatInt(data.average.kcal)} ${fr.common.kcal}`} />
            <Tile label={fr.week.proteinPerDay} value={`${formatInt(data.average.protein)} ${fr.common.grams}`} />
            <Tile label={fr.week.carbsPerDay} value={`${formatInt(data.average.carbs)} ${fr.common.grams}`} />
            <Tile label={fr.week.fatPerDay} value={`${formatInt(data.average.fat)} ${fr.common.grams}`} />
          </div>
        </>
      )}
    </div>
  )
}

function WeekRingCard({ data, isCurrent }: { data: WeekSummaryDto; isCurrent: boolean }) {
  const { eaten, target, left } = data
  const overBy = left !== null && left.kcal < 0 ? -left.kcal : null
  return (
    <section className={styles.card}>
      <div className={styles.summaryTop}>
        <Ring value={eaten.kcal} target={target?.kcal ?? null}>
          {overBy !== null ? (
            <>
              <div className={`${styles.ringLabel} ${styles.overText}`}>{fr.day.overBy}</div>
              <div className={`${styles.ringValue} ${styles.overText}`}>{formatInt(overBy)}</div>
              <div className={styles.ringLabel}>{fr.common.kcal}</div>
            </>
          ) : (
            <>
              <div className={styles.ringValue}>{left ? formatInt(left.kcal) : fr.common.noValue}</div>
              <div className={styles.ringLabel}>
                {fr.week.kcalLeft}
                {isCurrent && (
                  <>
                    <br />
                    {fr.week.leftThisWeek}
                  </>
                )}
              </div>
            </>
          )}
        </Ring>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>{fr.day.eaten}</div>
            <div className={styles.statValue}>{formatInt(eaten.kcal)}</div>
          </div>
          <Link to={GOAL_PATH} className={styles.stat} aria-label={fr.week.editGoal}>
            <div className={styles.statLabel}>
              {fr.week.weeklyGoal} <Pencil className={styles.pencil} />
            </div>
            <div className={styles.statValue}>{target ? formatInt(target.kcal) : fr.common.noValue}</div>
          </Link>
        </div>
      </div>
    </section>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.tile}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  )
}
