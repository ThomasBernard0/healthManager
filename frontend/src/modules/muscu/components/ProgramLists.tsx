import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { programsCreate } from '../../../api/generated/endpoints/programs/programs'
import type { ProgramSummaryDto, WorkoutSummaryDto } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { ChevronRight } from '../../../core/ui/icons'
import { Sheet } from '../../../core/ui/Sheet'
import form from '../../../core/ui/form.module.css'
import { fr } from '../../../i18n/fr'
import { formatSessionDate } from '../format'
import { programPath, workoutPath } from '../routes'
import { useActivateProgram } from '../useActivateProgram'
import styles from '../pages/HomePage.module.css'

/** Séances of a program in rotation order (the next one tagged), each → Modifier la séance. */
export function WorkoutRows({ workouts }: { workouts: WorkoutSummaryDto[] }) {
  return (
    <ul className={styles.rows}>
      {workouts.map((w) => (
        <li key={w.id}>
          <Link to={workoutPath(w.id)} className={styles.row}>
            <span className={`${styles.position} ${w.isNext ? styles.positionNext : ''}`}>{w.position}</span>
            <span className={styles.rowText}>
              <span className={styles.rowName}>{w.name}</span>
              <span className={styles.rowMeta}>
                {[fr.muscu.home.exerciseCount(w.exercises.length), w.lastDoneOn && formatSessionDate(w.lastDoneOn)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            {w.isNext && <span className={styles.upNext}>{fr.muscu.home.upNext}</span>}
            <ChevronRight size={18} className={styles.chevron} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

interface ActivateProgramSheetProps {
  program: { id: string; name: string }
  /** Activated (the data is reloaded). */
  onActivated: () => void
  onCancel: () => void
}

/** "Activer « X » ?": the only active program from now on, its rotation restarting at its first séance. */
export function ActivateProgramSheet({ program, onActivated, onCancel }: ActivateProgramSheetProps) {
  const { activate, busy, error } = useActivateProgram()
  return (
    <ConfirmSheet
      title={fr.muscu.program.confirmActivate(program.name)}
      confirmLabel={fr.muscu.program.activate}
      tone="accent"
      busy={busy !== null}
      error={error ? fr.common.saveError : null}
      onConfirm={async () => {
        if (await activate(program.id)) onActivated()
      }}
      onCancel={onCancel}
    />
  )
}

/** The inactive programs: name, séance count (→ its page) and Activer (after confirmation). */
export function ProgramRows({ programs }: { programs: ProgramSummaryDto[] }) {
  const [confirming, setConfirming] = useState<ProgramSummaryDto | null>(null)
  return (
    <>
      {confirming && (
        <ActivateProgramSheet
          program={confirming}
          onActivated={() => setConfirming(null)}
          onCancel={() => setConfirming(null)}
        />
      )}
      <ul className={styles.rows}>
        {programs.map((p) => (
          <li key={p.id} className={styles.programRow}>
            <Link to={programPath(p.id)} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowName}>{p.name}</span>
                <span className={styles.rowMeta}>{fr.muscu.program.workoutCount(p.workoutCount)}</span>
              </span>
            </Link>
            <button
              type="button"
              className={styles.activate}
              aria-label={fr.muscu.program.activateNamed(p.name)}
              onClick={() => setConfirming(p)}
            >
              {fr.muscu.program.activate}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Nouveau programme: a name, then its page (to add séances). */
export function NewProgramSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle')
  const valid = name.trim() !== ''

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setStatus('busy')
    try {
      const program = await programsCreate({ name: name.trim() })
      invalidateData()
      navigate(programPath(program.id), { replace: true })
    } catch {
      setStatus('error')
    }
  }

  return (
    <Sheet title={fr.muscu.program.newTitle} onClose={onClose}>
      <form className={styles.sheetForm} onSubmit={save}>
        <label className={form.field}>
          {fr.muscu.program.name}
          <input className={form.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        {status === 'error' && (
          <div className={form.error} role="alert">
            {fr.common.saveError}
          </div>
        )}
        <button type="submit" className={form.primary} disabled={!valid || status === 'busy'}>
          {fr.common.save}
        </button>
      </form>
    </Sheet>
  )
}
