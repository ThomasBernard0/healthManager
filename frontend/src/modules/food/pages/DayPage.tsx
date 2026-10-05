import { addDays, isIsoDate, parisToday, weekStart } from '@healthmanager/shared'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { summaryDay } from '../../../api/generated/endpoints/summary/summary'
import type { DaySummaryDto, LogEntryDto } from '../../../api/generated/model'
import { formatDayTitle, formatInt, formatLongDate, formatMacros, formatQuantity } from '../../../core/format'
import { ChevronLeft, ChevronRight, Pencil, Plus } from '../../../core/ui/icons'
import { MacroBar } from '../../../core/ui/MacroBar'
import { Ring } from '../../../core/ui/Ring'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useOverlayParam } from '../../../core/useOverlayParam'
import { fr } from '../../../i18n/fr'
import { AddMealSheet } from '../components/AddMealSheet'
import { EntrySheet } from '../components/EntrySheet'
import { ViewToggle } from '../components/ViewToggle'
import { QuickEntrySheet } from '../components/QuickEntrySheet'
import { dayPath, GOAL_PATH, newMealPath, weekPath } from '../routes'
import styles from './DayPage.module.css'

/** Aujourd'hui (Jour view): the selected day, its meals, and the week so far. */
export default function DayPage() {
  const { date: param } = useParams()
  if (param !== undefined && !isIsoDate(param)) return <Navigate to={dayPath()} replace />
  return <Day date={param ?? parisToday()} />
}

function Day({ date }: { date: string }) {
  const navigate = useNavigate()
  const summary = useAsync(() => summaryDay(date), date)
  const add = useOverlayParam('ajout')
  const entryParam = useOverlayParam('entree')
  const data = summary.data?.date === date ? summary.data : undefined
  const today = data?.today ?? parisToday()
  const entry = data?.entries.find((e) => e.id === entryParam.value)

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.module}>{fr.app.title}</div>
        <div className={styles.switcher}>
          <button
            type="button"
            className={styles.arrow}
            aria-label={fr.days.previous}
            onClick={() => navigate(dayPath(addDays(date, -1)))}
          >
            <ChevronLeft size={18} />
          </button>
          <div className={styles.dateBlock}>
            <h1 className={styles.dayTitle}>{formatDayTitle(date, today)}</h1>
            <div className={styles.dateSub}>{formatLongDate(date)}</div>
          </div>
          <button
            type="button"
            className={styles.arrow}
            aria-label={fr.days.next}
            onClick={() => navigate(dayPath(addDays(date, 1)))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <ViewToggle dayTo={dayPath(date)} weekTo={weekPath(weekStart(date))} />
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
          <SummaryCard data={data} isToday={date === today} />
          <MealsCard entries={data.entries} eatenKcal={data.eaten.kcal} onOpen={(e) => entryParam.open(e.id)} />
        </>
      )}

      <button type="button" className={styles.fab} onClick={() => add.open('repas')}>
        <Plus />
        {fr.day.add}
      </button>

      {add.value === 'repas' && (
        <AddMealSheet
          date={date}
          today={today}
          onClose={add.close}
          onQuickEntry={() => add.swap('saisie')}
          onNewMeal={(name) =>
            navigate(newMealPath(date) + (name ? `&nom=${encodeURIComponent(name)}` : ''), { replace: true })
          }
          onLogged={summary.reload}
        />
      )}

      {add.value === 'saisie' && (
        <QuickEntrySheet
          date={date}
          today={today}
          onClose={add.close}
          onBack={() => add.swap('repas')}
          onSaveInstead={(draft) => navigate(newMealPath(date), { replace: true, state: { draft } })}
          onLogged={() => {
            add.close()
            summary.reload()
          }}
        />
      )}

      {entry && (
        <EntrySheet
          entry={entry}
          today={today}
          onClose={entryParam.close}
          onChanged={summary.reload}
        />
      )}
    </div>
  )
}

function SummaryCard({ data, isToday }: { data: DaySummaryDto; isToday: boolean }) {
  const { goal, eaten, left, week } = data
  const overBy = left !== null && left.kcal < 0 ? -left.kcal : null

  return (
    <section className={styles.card}>
      <div className={styles.summaryTop}>
        <Ring value={eaten.kcal} target={goal?.dailyKcal ?? null}>
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
                {fr.day.kcalLeft}
                {isToday && (
                  <>
                    <br />
                    {fr.day.leftToday}
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
          <Link to={GOAL_PATH} className={styles.stat} aria-label={fr.day.editDailyGoal}>
            <div className={styles.statLabel}>
              {fr.day.dailyGoal} <Pencil className={styles.pencil} />
            </div>
            <div className={styles.statValue}>{goal ? formatInt(goal.dailyKcal) : fr.common.noValue}</div>
          </Link>
          <Link to={weekPath(week.monday)} className={styles.stat}>
            <div className={styles.statLabel}>{fr.day.week}</div>
            <div className={styles.weekValue}>
              {formatInt(week.eaten.kcal)} / {week.target ? formatInt(week.target.kcal) : fr.common.noValue}
            </div>
            {week.left && week.left.kcal < 0 && (
              <div className={styles.overLine}>{fr.over(formatInt(-week.left.kcal))}</div>
            )}
          </Link>
        </div>
      </div>

      <div className={styles.macros}>
        <MacroBar macro="protein" eaten={eaten.protein} target={goal?.protein ?? null} />
        <MacroBar macro="carbs" eaten={eaten.carbs} target={goal?.carbs ?? null} />
        <MacroBar macro="fat" eaten={eaten.fat} target={goal?.fat ?? null} />
      </div>
    </section>
  )
}

interface MealsCardProps {
  entries: LogEntryDto[]
  eatenKcal: number
  onOpen: (entry: LogEntryDto) => void
}

function MealsCard({ entries, eatenKcal, onOpen }: MealsCardProps) {
  return (
    <section className={styles.mealsCard}>
      <div className={styles.mealsHeader}>
        <h2 className={styles.mealsTitle}>{fr.day.meals}</h2>
        <div className={styles.mealsMeta}>
          {fr.day.mealCount(entries.length)} · {formatInt(eatenKcal)} {fr.common.kcal}
        </div>
      </div>
      {entries.length > 0 && (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" className={styles.entry} onClick={() => onOpen(entry)}>
                <span className={styles.time}>{entry.time}</span>
                <span className={styles.entryMain}>
                  <span className={styles.entryName}>
                    {entry.label}
                    {entry.quantity !== 1 && (
                      <span className={styles.quantity}> {formatQuantity(entry.quantity)}</span>
                    )}
                  </span>
                  <span className={styles.entryMacros}>{formatMacros(entry.total)}</span>
                </span>
                <span className={styles.entryKcal}>{formatInt(entry.total.kcal)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
