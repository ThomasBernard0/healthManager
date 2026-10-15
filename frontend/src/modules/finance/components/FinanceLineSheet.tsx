import {
  FINANCE_CATEGORIES,
  FINANCE_NAME_MAX,
  parseEurosToCents,
  type FinanceCategory,
  type FinanceKind,
} from '@healthmanager/shared'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  financeLinesCreate,
  financeLinesList,
  financeLinesRemove,
  financeLinesUpdate,
} from '../../../api/generated/endpoints/finances/finances'
import type { FinanceLineDto } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import { eurosInput } from '../../../core/format'
import { Close } from '../../../core/ui/icons'
import { Segmented } from '../../../core/ui/Segmented'
import { useToast } from '../../../core/ui/toastContext'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { FINANCE_PATH } from '../routes'
import { CategorySquare } from './CategorySquare'
import styles from './FinanceLineSheet.module.css'

const KINDS = [
  { value: 'expense', label: fr.finance.expense },
  { value: 'income', label: fr.finance.incomeKind },
] as const

/** Ajouter (/finances/nouveau) or Modifier (/finances/:id) a line; a dialog over Mon mois. */
export default function FinanceLineSheet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const close = () => (location.key !== 'default' ? navigate(-1) : navigate(FINANCE_PATH))
  // No GET /:id: the list is small, find the line in it.
  const lines = useAsync(() => (id ? financeLinesList() : Promise.resolve([])), `finance-line#${id ?? ''}`)
  const line = id ? lines.data?.find((l) => l.id === id) : undefined

  if (id && lines.status === 'ok' && !line) return <Navigate to={FINANCE_PATH} replace />

  return (
    <div className={styles.sheet}>
      <div className={styles.handle} aria-hidden="true" />
      <header className={styles.header}>
        <h1 className={styles.title}>{id ? fr.finance.editTitle : fr.finance.addTitle}</h1>
        <button type="button" className={styles.close} aria-label={fr.common.close} onClick={close}>
          <Close size={20} />
        </button>
      </header>
      {lines.status === 'error' && (
        <div className={styles.error} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={lines.reload}>
            {fr.common.retry}
          </button>
        </div>
      )}
      {(!id || line) && <LineForm key={line?.id ?? 'new'} line={line} onDone={close} />}
    </div>
  )
}

function LineForm({ line, onDone }: { line?: FinanceLineDto; onDone: () => void }) {
  const toast = useToast()
  const [kind, setKind] = useState<FinanceKind>(line?.kind ?? 'expense')
  const [name, setName] = useState(line?.name ?? '')
  const [amount, setAmount] = useState(line ? eurosInput(line.amountCents) : '')
  const [category, setCategory] = useState<FinanceCategory | null>(line?.category ?? null)
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')

  const amountCents = parseEurosToCents(amount)
  const trimmed = name.trim()
  const valid =
    trimmed.length >= 1 &&
    trimmed.length <= FINANCE_NAME_MAX &&
    amountCents !== null &&
    (kind === 'income' || category !== null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || amountCents === null) return
    const body = { kind, name: trimmed, amountCents, category: kind === 'income' ? null : category }
    setState('busy')
    try {
      if (line) await financeLinesUpdate(line.id, body)
      else await financeLinesCreate(body)
    } catch {
      setState('error')
      return
    }
    invalidateData()
    onDone()
  }

  async function remove(target: FinanceLineDto) {
    setState('busy')
    try {
      await financeLinesRemove(target.id)
    } catch {
      setState('error')
      return
    }
    invalidateData()
    onDone()
    toast({
      message: fr.finance.deleted,
      action: {
        label: fr.finance.undo,
        onClick: () => {
          void financeLinesCreate({
            kind: target.kind,
            name: target.name,
            amountCents: target.amountCents,
            category: target.category,
          }).then(invalidateData)
        },
      },
    })
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Segmented label={fr.finance.kind} value={kind} options={KINDS} onChange={setKind} />

      <label className={form.field}>
        {fr.finance.name}
        <input
          className={form.input}
          type="text"
          value={name}
          maxLength={FINANCE_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className={form.field}>
        {fr.finance.amount}
        <span className={form.affix}>
          <input
            className={form.affixInput}
            type="text"
            inputMode="decimal"
            aria-label={fr.finance.amount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className={form.affixUnit}>{fr.finance.euro}</span>
        </span>
      </label>

      {kind === 'expense' && (
        <div className={form.field} role="group" aria-label={fr.finance.category}>
          <span aria-hidden="true">{fr.finance.category}</span>
          <div className={styles.pills}>
            {FINANCE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                className={category === c ? styles.pillActive : styles.pill}
                onClick={() => setCategory(c)}
              >
                <CategorySquare category={c} small />
                {fr.finance.categories[c]}
              </button>
            ))}
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className={form.error} role="alert">
          {fr.common.saveError}
        </div>
      )}

      <button className={`${form.primary} ${styles.save}`} type="submit" disabled={!valid || state === 'busy'}>
        {fr.common.save}
      </button>
      {line && (
        <button type="button" className={form.danger} disabled={state === 'busy'} onClick={() => void remove(line)}>
          {fr.finance.delete}
        </button>
      )}
    </form>
  )
}
