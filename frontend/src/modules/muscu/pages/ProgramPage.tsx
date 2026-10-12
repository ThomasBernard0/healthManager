import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { programsGet, programsRemove, programsUpdate } from '../../../api/generated/endpoints/programs/programs'
import type { ProgramDto } from '../../../api/generated/model'
import { invalidateData, useDataVersion } from '../../../core/dataVersion'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { ChevronLeft, Trash } from '../../../core/ui/icons'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { fr } from '../../../i18n/fr'
import { MuscuLayout } from '../components/MuscuLayout'
import { ActivateProgramSheet, WorkoutRows } from '../components/ProgramLists'
import { MUSCU_PATH, newWorkoutPath } from '../routes'
import home from './HomePage.module.css'
import page from './page.module.css'
import styles from './ProgramPage.module.css'

/** Programme: its name and séances; Activer when it isn't the active one. */
export default function ProgramPage() {
  const { id = '' } = useParams()
  const version = useDataVersion()
  const program = useAsync(() => programsGet(id), `program:${id}#${version}`)
  const loaded = program.data?.id === id

  if (program.status === 'error' && !loaded) {
    return (
      <MuscuLayout>
        <div className={page.alert} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={program.reload}>
            {fr.common.retry}
          </button>
        </div>
      </MuscuLayout>
    )
  }
  if (!loaded) return <MuscuLayout>{null}</MuscuLayout>
  return <Program key={id} program={program.data!} />
}

function Program({ program }: { program: ProgramDto }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState(program.name)
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle')
  const [confirmDelete, setConfirmDelete] = useState<'closed' | 'open' | 'busy' | 'error'>('closed')
  const [confirmActivate, setConfirmActivate] = useState(false)

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(MUSCU_PATH))
  const valid = name.trim() !== ''

  async function rename(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setStatus('busy')
    try {
      await programsUpdate(program.id, { name: name.trim() })
    } catch {
      setStatus('error')
      return
    }
    setStatus('idle')
    invalidateData()
  }

  async function deleteProgram() {
    setConfirmDelete('busy')
    try {
      await programsRemove(program.id)
    } catch {
      setConfirmDelete('error')
      return
    }
    invalidateData()
    navigate(MUSCU_PATH, { replace: true })
  }

  return (
    <MuscuLayout>
      <header className={page.header}>
        <button type="button" className={page.iconButton} aria-label={fr.common.back} onClick={back}>
          <ChevronLeft />
        </button>
        <h1 className={page.title}>{fr.muscu.program.title}</h1>
        {program.active ? (
          <span className={page.spacer} />
        ) : (
          <button
            type="button"
            className={`${page.iconButton} ${styles.muted}`}
            aria-label={fr.muscu.program.delete}
            onClick={() => setConfirmDelete('open')}
          >
            <Trash size={20} />
          </button>
        )}
      </header>

      <form className={styles.rename} onSubmit={rename}>
        <label className={form.field}>
          {fr.muscu.program.name}
          <input className={form.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        {status === 'error' && (
          <div className={form.error} role="alert">
            {fr.common.saveError}
          </div>
        )}
        {name.trim() !== program.name && (
          <button type="submit" className={form.primary} disabled={!valid || status === 'busy'}>
            {fr.common.save}
          </button>
        )}
      </form>

      {!program.active && (
        <button type="button" className={home.start} onClick={() => setConfirmActivate(true)}>
          {fr.muscu.program.activateThis}
        </button>
      )}

      <section className={home.section}>
        <div className={styles.sectionHeader}>
          <h2 className={home.sectionTitle}>{fr.muscu.program.workouts}</h2>
          {program.active && <span className={home.upNext}>{fr.muscu.program.active}</span>}
        </div>
        {program.workouts.length > 0 && (
          <div className={home.listCard}>
            <WorkoutRows workouts={program.workouts} />
          </div>
        )}
        <Link to={newWorkoutPath(program.id)} className={home.newWorkout}>
          {fr.muscu.home.newWorkout}
        </Link>
      </section>

      {confirmActivate && (
        <ActivateProgramSheet
          program={program}
          onActivated={() => navigate(MUSCU_PATH)}
          onCancel={() => setConfirmActivate(false)}
        />
      )}

      {confirmDelete !== 'closed' && (
        <ConfirmSheet
          title={fr.muscu.program.confirmDelete(program.name)}
          confirmLabel={fr.muscu.program.deleteAction}
          busy={confirmDelete === 'busy'}
          error={confirmDelete === 'error' ? fr.common.saveError : null}
          onConfirm={deleteProgram}
          onCancel={() => setConfirmDelete('closed')}
        />
      )}
    </MuscuLayout>
  )
}
