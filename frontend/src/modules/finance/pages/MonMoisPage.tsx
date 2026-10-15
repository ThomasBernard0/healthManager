import {
  categoryShare,
  FINANCE_CATEGORIES,
  financeTotals,
  restRingFraction,
  sortByAmount,
  type FinanceCategory,
  type FinanceTotals,
} from '@healthmanager/shared'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { financeLinesList } from '../../../api/generated/endpoints/finances/finances'
import type { FinanceLineDto } from '../../../api/generated/model'
import { useDataVersion } from '../../../core/dataVersion'
import { formatEuros } from '../../../core/format'
import { ChevronRight, Plus } from '../../../core/ui/icons'
import { ModuleSwitcher } from '../../../core/ui/ModuleSwitcher'
import { Ring } from '../../../core/ui/Ring'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useIsDesktop } from '../../../core/useIsDesktop'
import { fr } from '../../../i18n/fr'
import { CategorySquare } from '../components/CategorySquare'
import { financeLinePath, NEW_FINANCE_LINE_PATH } from '../routes'
import styles from './MonMoisPage.module.css'

interface Section {
  category: FinanceCategory
  total: number
  lines: FinanceLineDto[]
}

/** Desktop Dépenses card: two inner columns. */
const DESKTOP_COLUMNS: FinanceCategory[][] = [
  ['housing', 'savings'],
  ['subscriptions', 'other'],
]

/** Mon mois: the typical month's incomes and expenses, and what is left. */
export default function MonMoisPage() {
  const version = useDataVersion()
  const lines = useAsync(() => financeLinesList(), `finance#${version}`)
  const desktop = useIsDesktop()
  const location = useLocation()
  const all = lines.data ?? []

  const totals = financeTotals(all)
  const incomes = sortByAmount(all.filter((l) => l.kind === 'income'))
  // A category with no line is not shown.
  const sections: Section[] = FINANCE_CATEGORIES.map((category) => ({
    category,
    total: totals.byCategory[category],
    lines: sortByAmount(all.filter((l) => l.kind === 'expense' && l.category === category)),
  })).filter((s) => s.lines.length > 0)

  const error = lines.status === 'error' && !lines.data && (
    <div className={styles.card} role="alert">
      <span className={form.error}>{fr.common.loadError}</span>
      <button type="button" className={form.secondary} onClick={lines.reload}>
        {fr.common.retry}
      </button>
    </div>
  )
  const addLink = { to: NEW_FINANCE_LINE_PATH, state: { background: location } }

  if (desktop) {
    return (
      <div className={styles.desktop}>
        <header className={styles.topBar}>
          <div className={styles.barInner}>
            <ModuleSwitcher current="finance" variant="desktop" />
            <Link {...addLink} className={styles.addButton}>
              <Plus size={16} />
              {fr.finance.add}
            </Link>
          </div>
        </header>
        <main className={styles.columns}>
          {error}
          {lines.data && (
            <>
              <section className={styles.summaryColumn}>
                <div className={`${styles.card} ${styles.summaryDesktop}`}>
                  <div className={styles.ringArea}>
                    <RestRing totals={totals} desktop />
                  </div>
                  <div className={styles.figuresDesktop}>
                    <Figure label={fr.finance.income} cents={totals.income} />
                    <Figure label={fr.finance.expenses} cents={totals.expenses} />
                  </div>
                  <StackedBar totals={totals} />
                  <Legend totals={totals} sections={sections} />
                </div>
              </section>
              <section className={styles.listsColumn}>
                <Incomes lines={incomes} total={totals.income} chevron={false} />
                {sections.length > 0 && (
                  <Expenses total={totals.expenses}>
                    <div className={styles.expenseColumns}>
                      {DESKTOP_COLUMNS.map((column) => {
                        const shown = sections.filter((s) => column.includes(s.category))
                        return shown.length > 0 ? (
                          <div key={column.join()}>
                            {shown.map((s) => (
                              <CategorySection key={s.category} section={s} chevron={false} />
                            ))}
                          </div>
                        ) : null
                      })}
                    </div>
                  </Expenses>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <ModuleSwitcher current="finance" />
      {error}
      {lines.data && (
        <>
          <section className={styles.card}>
            <div className={styles.summaryTop}>
              <RestRing totals={totals} />
              <div className={styles.figures}>
                <Figure label={fr.finance.income} cents={totals.income} />
                <Figure label={fr.finance.expenses} cents={totals.expenses} />
              </div>
            </div>
            <StackedBar totals={totals} />
          </section>
          <Incomes lines={incomes} total={totals.income} chevron />
          {sections.length > 0 && (
            <Expenses total={totals.expenses}>
              {sections.map((s) => (
                <CategorySection key={s.category} section={s} chevron />
              ))}
            </Expenses>
          )}
        </>
      )}
      <Link {...addLink} className={styles.fab}>
        <Plus />
        {fr.finance.add}
      </Link>
    </div>
  )
}

function RestRing({ totals, desktop }: { totals: FinanceTotals; desktop?: boolean }) {
  const negative = totals.rest < 0
  return (
    <Ring
      value={restRingFraction(totals)}
      target={1}
      over={negative}
      className={desktop ? styles.ringDesktop : styles.ring}
    >
      <span className={`${styles.restAmount} ${negative ? styles.negative : ''}`} data-testid="rest">
        {formatEuros(totals.rest)}
      </span>
      <span className={styles.restLabel}>{fr.finance.restPerMonth}</span>
    </Ring>
  )
}

function Figure({ label, cents }: { label: string; cents: number }) {
  return (
    <div className={styles.figure}>
      <span className={styles.figureLabel}>{label}</span>
      <span className={styles.figureValue}>{formatEuros(cents)}</span>
    </div>
  )
}

/** Each category in its colour, proportional to its total, then the remainder in the track colour. */
function StackedBar({ totals }: { totals: FinanceTotals }) {
  const parts = FINANCE_CATEGORIES.filter((c) => totals.byCategory[c] > 0)
  const remainder = Math.max(totals.rest, 0)
  return (
    <div className={styles.bar} aria-hidden="true">
      {parts.map((c) => (
        <span key={c} className={styles[c]} style={{ flex: totals.byCategory[c] }} />
      ))}
      {(remainder > 0 || parts.length === 0) && <span className={styles.remainder} style={{ flex: remainder || 1 }} />}
    </div>
  )
}

/** Desktop: one row per non-empty category (% of Entrées, amount), then Reste. */
function Legend({ totals, sections }: { totals: FinanceTotals; sections: Section[] }) {
  return (
    <div className={styles.legend}>
      {sections.map((s) => (
        <div key={s.category} className={styles.legendRow}>
          <CategorySquare category={s.category} />
          <span className={styles.legendName}>{fr.finance.categories[s.category]}</span>
          <span className={styles.legendShare}>{categoryShare(s.total, totals.income)} %</span>
          <span className={styles.legendAmount}>{formatEuros(s.total)}</span>
        </div>
      ))}
      <div className={`${styles.legendRow} ${styles.legendRest}`}>
        <CategorySquare category="rest" />
        <span className={styles.legendName}>{fr.finance.rest}</span>
        <span className={styles.legendShare}>{categoryShare(totals.rest, totals.income)} %</span>
        <span className={`${styles.legendAmount} ${totals.rest < 0 ? styles.negative : ''}`}>
          {formatEuros(totals.rest)}
        </span>
      </div>
    </div>
  )
}

function SectionTitle({ title, total }: { title: string; total: number }) {
  return (
    <div className={styles.sectionTitle}>
      <h2 className={styles.h2}>{title}</h2>
      <span className={styles.sectionTotal}>{formatEuros(total)}</span>
    </div>
  )
}

function Incomes({ lines, total, chevron }: { lines: FinanceLineDto[]; total: number; chevron: boolean }) {
  if (lines.length === 0) return null
  return (
    <section className={styles.group} aria-label={fr.finance.income}>
      <SectionTitle title={fr.finance.income} total={total} />
      <div className={styles.listCard}>
        {lines.map((l) => (
          <LineRow key={l.id} line={l} chevron={chevron} />
        ))}
      </div>
    </section>
  )
}

function Expenses({ total, children }: { total: number; children: ReactNode }) {
  return (
    <section className={styles.group} aria-label={fr.finance.expenses}>
      <SectionTitle title={fr.finance.expenses} total={total} />
      <div className={`${styles.listCard} ${styles.expensesCard}`}>{children}</div>
    </section>
  )
}

function CategorySection({ section, chevron }: { section: Section; chevron: boolean }) {
  return (
    <div className={styles.category} role="group" aria-label={fr.finance.categories[section.category]}>
      <div className={styles.categoryHeader}>
        <CategorySquare category={section.category} />
        <span className={styles.categoryName}>{fr.finance.categories[section.category]}</span>
        <span>{formatEuros(section.total)}</span>
      </div>
      {section.lines.map((l) => (
        <LineRow key={l.id} line={l} chevron={chevron} inCategory />
      ))}
    </div>
  )
}

function LineRow({ line, chevron, inCategory }: { line: FinanceLineDto; chevron: boolean; inCategory?: boolean }) {
  const location = useLocation()
  return (
    <Link
      to={financeLinePath(line.id)}
      state={{ background: location }}
      className={`${styles.line} ${inCategory ? styles.categoryLine : ''}`}
    >
      <span className={styles.lineName}>{line.name}</span>
      <span className={styles.lineAmount}>{formatEuros(line.amountCents)}</span>
      {chevron && <ChevronRight size={16} className={styles.chevron} />}
    </Link>
  )
}
