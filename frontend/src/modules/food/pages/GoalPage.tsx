import { roundMacro } from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { goalsCurrent, goalsUpdate } from '../../../api/generated/endpoints/goals/goals'
import type { GoalDto } from '../../../api/generated/model'
import { formatInt, parseNumber } from '../../../core/format'
import { ChevronLeft } from '../../../core/ui/icons'
import { Stepper } from '../../../core/ui/Stepper'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { dayPath } from '../routes'
import styles from './GoalPage.module.css'

/** Starting values before any goal exists. */
const INITIAL_GOAL = { dailyKcal: 2200, protein: 150, carbs: 230, fat: 70 }

const KCAL_STEP = 50
const KCAL_MIN = 500
const KCAL_MAX = 10000

/** Mon objectif: daily kcal (±50) and daily macros. Saving applies from today on. */
export default function GoalPage() {
  const current = useAsync(() => goalsCurrent(), 'goal')
  const navigate = useNavigate()
  const location = useLocation()
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(dayPath()))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} aria-label={fr.common.back} onClick={back}>
          <ChevronLeft />
        </button>
        <h1 className={styles.title}>{fr.goal.title}</h1>
        <span className={styles.spacer} />
      </header>
      {current.status === 'error' && (
        <div className={styles.card} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={current.reload}>
            {fr.common.retry}
          </button>
        </div>
      )}
      {current.status === 'ok' && <GoalForm goal={current.data.goal} onSaved={back} />}
    </div>
  )
}

function GoalForm({ goal, onSaved }: { goal: GoalDto | null; onSaved: () => void }) {
  const start = goal ?? INITIAL_GOAL
  const [kcal, setKcal] = useState(start.dailyKcal)
  const [macros, setMacros] = useState({
    protein: String(start.protein),
    carbs: String(start.carbs),
    fat: String(start.fat),
  })
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  const values = {
    protein: parseNumber(macros.protein),
    carbs: parseNumber(macros.carbs),
    fat: parseNumber(macros.fat),
  }
  const valid = Object.values(values).every((v) => v !== null && v >= 0 && v <= 1000)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setState('saving')
    try {
      await goalsUpdate({
        dailyKcal: kcal,
        protein: roundMacro(values.protein ?? 0),
        carbs: roundMacro(values.carbs ?? 0),
        fat: roundMacro(values.fat ?? 0),
      })
      onSaved()
    } catch {
      setState('error')
    }
  }

  const rows = [
    { key: 'protein', label: fr.goal.proteinPerDay },
    { key: 'carbs', label: fr.goal.carbsPerDay },
    { key: 'fat', label: fr.goal.fatPerDay },
  ] as const

  return (
    <form className={styles.form} onSubmit={submit}>
      <section className={styles.card}>
        <div className={styles.cardLabel}>{fr.goal.kcalPerDay}</div>
        <Stepper
          size="lg"
          value={kcal}
          onChange={setKcal}
          step={KCAL_STEP}
          min={KCAL_MIN}
          max={KCAL_MAX}
          decreaseLabel={fr.goal.decrease}
          increaseLabel={fr.goal.increase}
        >
          {formatInt(kcal)} <span className={styles.unit}>{fr.common.kcal}</span>
        </Stepper>
      </section>

      <section className={styles.list}>
        {rows.map(({ key, label }) => (
          <label key={key} className={styles.row}>
            <span>{label}</span>
            <span className={styles.inputWrap}>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                aria-label={label}
                value={macros[key]}
                onChange={(e) => setMacros((m) => ({ ...m, [key]: e.target.value }))}
              />
              <span className={styles.unit}>{fr.common.grams}</span>
            </span>
          </label>
        ))}
      </section>

      {state === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.saveError}
        </div>
      )}

      <button className={form.primary} type="submit" disabled={!valid || state === 'saving'}>
        {fr.common.save}
      </button>
    </form>
  )
}
