import { deriveCarbs, isGoalValid, macroKcal, roundMacro } from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { goalsCurrent, goalsUpdate } from '../../../api/generated/endpoints/goals/goals'
import type { GoalDto } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import { formatInt, parseNumber } from '../../../core/format'
import { ChevronLeft } from '../../../core/ui/icons'
import { Stepper } from '../../../core/ui/Stepper'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { dayPath } from '../routes'
import styles from './GoalPage.module.css'

/** Starting values before any goal exists. */
const INITIAL_GOAL = { dailyKcal: 2200, protein: 150, fat: 70 }

const KCAL_STEP = 50
const KCAL_MIN = 500
const KCAL_MAX = 10000

/** Mon objectif: daily kcal (±50), protein and fat; carbs are derived. Saving applies from today on. */
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
    fat: String(start.fat),
  })
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  const values = {
    protein: parseNumber(macros.protein),
    fat: parseNumber(macros.fat),
  }
  const protein = roundMacro(values.protein ?? 0)
  const fat = roundMacro(values.fat ?? 0)
  // Carbs are what kcal leave once protein and fat are counted.
  const carbs = deriveCarbs(kcal, protein, fat)
  const fits = isGoalValid(kcal, protein, fat)
  const valid = fits && Object.values(values).every((v) => v !== null && v >= 0 && v <= 1000)

  const split = macroKcal({ protein, carbs: Math.max(carbs, 0), fat })
  const share = (part: number) => ({ width: `${(part / kcal) * 100}%` })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setState('saving')
    try {
      await goalsUpdate({ dailyKcal: kcal, protein, fat })
      invalidateData()
      onSaved()
    } catch {
      setState('error')
    }
  }

  const rows = [
    { key: 'protein', name: fr.macros.protein, label: fr.goal.proteinPerDay },
    { key: 'fat', name: fr.macros.fat, label: fr.goal.fatPerDay },
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
        <div className={styles.bar} aria-hidden="true">
          <div className={styles.protein} style={share(split.protein)} />
          <div className={styles.fat} style={share(split.fat)} />
          <div className={styles.carbs} style={share(split.carbs)} />
        </div>
      </section>

      <section className={styles.list}>
        {rows.map(({ key, name, label }) => (
          <label key={key} className={styles.row}>
            <span className={styles.name}>
              <span className={`${styles.dot} ${styles[key]}`} />
              {name}
            </span>
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
        <div className={styles.row}>
          <span className={styles.name}>
            <span className={`${styles.dot} ${styles.carbs}`} />
            {fr.macros.carbs}
          </span>
          <span className={styles.inputWrap}>
            <output
              className={`${styles.derived} ${fits ? '' : styles.derivedOver}`}
              aria-label={fr.goal.carbsPerDay}
            >
              {formatInt(carbs)}
            </output>
            <span className={styles.unit}>{fr.common.grams}</span>
          </span>
        </div>
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
