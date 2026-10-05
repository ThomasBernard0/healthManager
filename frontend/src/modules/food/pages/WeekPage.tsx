import { addDays, isIsoDate, parisToday, weekStart } from '@healthmanager/shared'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { summaryWeek } from '../../../api/generated/endpoints/summary/summary'
import type { WeekSummaryDto } from '../../../api/generated/model'
import { formatInt, formatWeekRange, formatWeekTitle } from '../../../core/format'
import { ChevronLeft, ChevronRight, Pencil } from '../../../core/ui/icons'
import { Ring } from '../../../core/ui/Ring'
import form from '../../../core/ui/form.module.css'
import { useDataVersion } from '../../../core/dataVersion'
import { useAsync } from '../../../core/useAsync'
import { useIsDesktop } from '../../../core/useIsDesktop'
import { fr } from '../../../i18n/fr'
import { TopBar } from '../components/TopBar'
import { ViewToggle } from '../components/ViewToggle'
import { WeekChart } from '../components/WeekChart'
import { WeekTable } from '../components/WeekTable'
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
  const version = useDataVersion()
  const summary = useAsync(() => summaryWeek(monday), `${monday}#${version}`)
  const data = summary.data?.monday === monday ? summary.data : undefined
  const today = data?.today ?? parisToday()
  const thisMonday = weekStart(today)
  // Jour shows today in the current week, else the Monday of the week viewed.
  const dayTarget = monday === thisMonday ? today : monday
  const desktop = useIsDesktop()
  // No browsing before the week of the first day with data (this week when there is none).
  const earliest = summary.data?.earliestDate
  const canGoBack = earliest !== undefined && monday > weekStart(earliest)

  if (data && monday < weekStart(data.earliestDate)) {
    return <Navigate to={weekPath(weekStart(data.earliestDate))} replace />
  }

  const error = summary.status === 'error' && !data && (
    <div className={styles.card} role="alert">
      <span className={form.error}>{fr.common.loadError}</span>
      <button type="button" className={form.secondary} onClick={summary.reload}>
        {fr.common.retry}
      </button>
    </div>
  )
  const tiles = data && (
    <div className={styles.tiles}>
      <Tile label={fr.week.averageKcal} value={`${formatInt(data.average.kcal)} ${fr.common.kcal}`} />
      <Tile label={fr.week.proteinPerDay} value={`${formatInt(data.average.protein)} ${fr.common.grams}`} />
      <Tile label={fr.week.carbsPerDay} value={`${formatInt(data.average.carbs)} ${fr.common.grams}`} />
      <Tile label={fr.week.fatPerDay} value={`${formatInt(data.average.fat)} ${fr.common.grams}`} />
    </div>
  )

  if (desktop) {
    return (
      <div className={styles.desktopPage}>
        <TopBar
          label={formatWeekRange(monday)}
          previousLabel={fr.week.previous}
          nextLabel={fr.week.next}
          onPrevious={() => navigate(weekPath(addDays(monday, -7)))}
          previousDisabled={!canGoBack}
          onNext={() => navigate(weekPath(addDays(monday, 7)))}
          currentLabel={fr.desktop.thisWeek}
          onCurrent={() => navigate(weekPath())}
          dayTo={dayPath(dayTarget)}
          weekTo={weekPath(monday)}
        />
        <main className={styles.desktopMain}>
          {error}
          {data && (
            <>
              <div className={styles.desktopRow}>
                <div className={styles.desktopRing}>
                  <WeekRingCard data={data} isCurrent={monday === thisMonday} variant="desktop" />
                </div>
                <div className={styles.desktopTiles}>{tiles}</div>
              </div>
              <div className={styles.desktopRow}>
                <div className={styles.desktopChart}>
                  <WeekChart
                    variant="desktop"
                    days={data.days}
                    today={today}
                    earliest={data.earliestDate}
                    onOpenDay={(date) => navigate(dayPath(date))}
                  />
                </div>
                <div className={styles.desktopTable}>
                  <WeekTable week={data} />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.switcher}>
          <button
            type="button"
            className={styles.arrow}
            aria-label={fr.week.previous}
            disabled={!canGoBack}
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
          <WeekChart
            days={data.days}
            today={today}
            earliest={data.earliestDate}
            onOpenDay={(date) => navigate(dayPath(date))} />
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

function WeekRingCard({
  data,
  isCurrent,
  variant = 'mobile',
}: {
  data: WeekSummaryDto
  isCurrent: boolean
  variant?: 'mobile' | 'desktop'
}) {
  const location = useLocation()
  const { eaten, target, left } = data
  const overBy = left !== null && left.kcal < 0 ? -left.kcal : null
  return (
    <section className={styles.card}>
      <div className={styles.summaryTop}>
        <Ring value={eaten.kcal} target={target?.kcal ?? null} variant={variant}>
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
          <Link to={GOAL_PATH} state={{ background: location }} className={styles.stat} aria-label={fr.week.editGoal}>
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
