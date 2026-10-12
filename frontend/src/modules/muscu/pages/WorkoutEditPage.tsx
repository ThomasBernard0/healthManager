import { useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { exercisesList } from '../../../api/generated/endpoints/exercises/exercises'
import { sessionsCurrent } from '../../../api/generated/endpoints/sessions/sessions'
import {
  workoutsCreate,
  workoutsGet,
  workoutsRemove,
  workoutsUpdate,
} from '../../../api/generated/endpoints/workouts/workouts'
import type { ExerciseDto, WorkoutDto } from '../../../api/generated/model'
import { invalidateData } from '../../../core/dataVersion'
import { ConfirmSheet } from '../../../core/ui/ConfirmSheet'
import { ChevronLeft, ChevronRight, Grip, LinkIcon, LinkOff, Play, Plus, Trash } from '../../../core/ui/icons'
import { Sheet } from '../../../core/ui/Sheet'
import { useToast } from '../../../core/ui/toastContext'
import form from '../../../core/ui/form.module.css'
import { useAsync } from '../../../core/useAsync'
import { useOverlayParam } from '../../../core/useOverlayParam'
import { fr } from '../../../i18n/fr'
import { ExerciseForm } from '../components/ExerciseForm'
import { ExerciseSearchList } from '../components/ExerciseSearchList'
import { ExerciseThumb } from '../components/ExerciseThumb'
import { MuscuLayout } from '../components/MuscuLayout'
import { SupersetBadge } from '../components/SupersetBadge'
import { WorkoutItemSheet, type ItemSettings } from '../components/WorkoutItemSheet'
import { primarySubtitle } from '../format'
import { moveBlock, moveItem, normalizeGroups, toBlocks } from '../reorder'
import { exercisePath, MUSCU_PATH } from '../routes'
import { useStartSession } from '../useStartSession'
import page from './page.module.css'
import styles from './WorkoutEditPage.module.css'

interface Item extends ItemSettings {
  exercise: ExerciseDto
  /** Superset: shared with the item next to it (null: solo). */
  group: string | null
}

/** A new exercise in a workout: 4 × 8–12. */
const DEFAULT_SETTINGS: ItemSettings = { sets: 4, repMin: 8, repMax: 12 }

/** Swiping a row this far to the left removes it. */
const SWIPE_REMOVE_PX = 96

/** Nouvelle séance / Modifier la séance. */
export default function WorkoutEditPage() {
  const { id } = useParams()
  const existing = useAsync(() => (id ? workoutsGet(id) : Promise.resolve(null)), id ?? 'new')
  const loaded = existing.data !== undefined && (existing.data === null || existing.data.id === id)

  if (existing.status === 'error' && !loaded) {
    return (
      <MuscuLayout>
        <div className={page.alert} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={existing.reload}>
            {fr.common.retry}
          </button>
        </div>
      </MuscuLayout>
    )
  }
  if (!loaded) return <MuscuLayout>{null}</MuscuLayout>
  return <Editor key={id ?? 'new'} workout={existing.data ?? null} />
}

function Editor({ workout }: { workout: WorkoutDto | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [name, setName] = useState(workout?.name ?? '')
  const [items, setItems] = useState<Item[]>(() => workout?.items ?? [])
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle')
  const [confirmDelete, setConfirmDelete] = useState<'closed' | 'open' | 'busy' | 'error'>('closed')
  const picker = useOverlayParam('ajout')
  const editing = useOverlayParam('exercice')
  const edited = items.find((i) => i.exercise.id === editing.value)
  // Nouvelle séance from a program's page: into that program (else the active one).
  const [params] = useSearchParams()
  const programId = params.get('programme')
  const session = useStartSession()
  // Start this workout (not only the next one) as last saved, when no session is in progress: active program only.
  const current = useAsync(() => (workout ? sessionsCurrent() : Promise.resolve(null)), workout?.id ?? 'new')
  const canStart =
    workout !== null && workout.programActive && workout.items.length > 0 && current.data?.session === null

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(MUSCU_PATH))
  const valid = name.trim() !== ''
  const blocks = toBlocks(items)
  const add = (exercise: ExerciseDto) => setItems((list) => [...list, { exercise, ...DEFAULT_SETTINGS, group: null }])

  function remove(exerciseId: string) {
    const index = items.findIndex((i) => i.exercise.id === exerciseId)
    if (index === -1) return
    const removed = items[index]
    // Its superset partner becomes solo, and is linked again if the removal is undone.
    const partner = removed.group ? items.find((i) => i.group === removed.group && i !== removed) : undefined
    setItems((list) => normalizeGroups(list.filter((i) => i.exercise.id !== exerciseId)))
    toast({
      message: fr.muscu.workout.removed(removed.exercise.name),
      action: {
        label: fr.common.cancel,
        onClick: () =>
          setItems((list) => {
            if (list.some((i) => i.exercise.id === exerciseId)) return list
            const restored = moveItem([...list, removed], list.length, index)
            return normalizeGroups(
              restored.map((i) => (i.exercise.id === partner?.exercise.id ? { ...i, group: removed.group } : i)),
            )
          }),
      },
    })
  }

  /** Superset of the exercise and the one after it (the id only has to be unique in the workout). */
  const link = (exerciseId: string) =>
    setItems((list) => {
      const index = list.findIndex((i) => i.exercise.id === exerciseId)
      return list.map((i, k) => (k === index || k === index + 1 ? { ...i, group: exerciseId } : i))
    })
  const unlink = (group: string) => setItems((list) => list.map((i) => (i.group === group ? { ...i, group: null } : i)))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setStatus('busy')
    const body = {
      name: name.trim(),
      items: items.map((i) => ({
        exerciseId: i.exercise.id,
        sets: i.sets,
        repMin: i.repMin,
        repMax: i.repMax,
        ...(i.group ? { group: i.group } : {}),
      })),
    }
    try {
      if (workout) await workoutsUpdate(workout.id, body)
      else await workoutsCreate(programId ? { ...body, programId } : body)
    } catch {
      setStatus('error')
      return
    }
    invalidateData()
    back()
  }

  async function deleteWorkout() {
    if (!workout) return
    setConfirmDelete('busy')
    try {
      await workoutsRemove(workout.id)
    } catch {
      setConfirmDelete('error')
      return
    }
    invalidateData()
    navigate(MUSCU_PATH, { replace: true })
  }

  return (
    <MuscuLayout>
      <form className={styles.form} onSubmit={save}>
        <header className={page.header}>
          <button type="button" className={page.iconButton} aria-label={fr.common.back} onClick={back}>
            <ChevronLeft />
          </button>
          <h1 className={page.title}>{fr.muscu.workout.title}</h1>
          {workout ? (
            <button
              type="button"
              className={`${page.iconButton} ${styles.muted}`}
              aria-label={fr.muscu.workout.delete}
              onClick={() => setConfirmDelete('open')}
            >
              <Trash size={20} />
            </button>
          ) : (
            <span className={page.spacer} />
          )}
        </header>

        <label className={form.field}>
          {fr.muscu.workout.name}
          <input className={form.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>

        {items.length > 0 && (
          <ul className={styles.list}>
            {blocks.map((block, index) => {
              const [item, second] = block
              const onMove = (steps: number) => setItems((list) => moveBlock(list, index, steps))
              return second ? (
                <SupersetBlock
                  key={item.group}
                  items={[item, second]}
                  onMove={onMove}
                  onEdit={(exerciseId) => editing.open(exerciseId)}
                  onUnlink={() => unlink(item.group!)}
                />
              ) : (
                <ItemRow
                  key={item.exercise.id}
                  item={item}
                  onMove={onMove}
                  onEdit={() => editing.open(item.exercise.id)}
                  onRemove={() => remove(item.exercise.id)}
                  // Only with the next exercise, when it is not in a superset either.
                  onLink={blocks[index + 1]?.length === 1 ? () => link(item.exercise.id) : undefined}
                />
              )
            })}
          </ul>
        )}

        <button type="button" className={styles.addExercise} onClick={() => picker.open('exercice')}>
          {fr.muscu.workout.addExercise}
        </button>

        {status === 'error' && (
          <div className={form.error} role="alert">
            {fr.common.saveError}
          </div>
        )}


        <button type="submit" className={`${form.primary} ${styles.submit}`} disabled={!valid || status === 'busy'}>
          {fr.common.save}
        </button>

        {canStart && (
          <button
            type="button"
            className={styles.startLink}
            disabled={session.status === 'busy'}
            onClick={() => session.start(workout.id)}
          >
            <Play size={14} />
            {fr.muscu.workout.start}
          </button>
        )}
      </form>

      {picker.value === 'exercice' && (
        <ExercisePicker
          workoutName={name.trim() || fr.muscu.workout.title}
          inWorkout={new Set(items.map((i) => i.exercise.id))}
          onAdd={add}
          onCreate={() => picker.swap('nouvel-exercice')}
          onClose={picker.close}
        />
      )}

      {picker.value === 'nouvel-exercice' && (
        <Sheet
          title={fr.muscu.createExercise}
          dismiss="back"
          onBack={() => picker.swap('exercice')}
          onClose={picker.close}
        >
          <ExerciseForm
            exercise={null}
            onSaved={(exercise) => {
              add(exercise)
              picker.close()
            }}
          />
        </Sheet>
      )}

      {edited && (
        <WorkoutItemSheet
          name={edited.exercise.name}
          value={edited}
          onApply={(settings) => {
            setItems((list) => list.map((i) => (i.exercise.id === edited.exercise.id ? { ...i, ...settings } : i)))
            editing.close()
          }}
          onRemove={() => {
            editing.close()
            remove(edited.exercise.id)
          }}
          onClose={editing.close}
        />
      )}

      {workout && confirmDelete !== 'closed' && (
        <ConfirmSheet
          title={fr.muscu.workout.confirmDelete(workout.name)}
          confirmLabel={fr.muscu.workout.deleteAction}
          busy={confirmDelete === 'busy'}
          error={confirmDelete === 'error' ? fr.common.saveError : null}
          onConfirm={deleteWorkout}
          onCancel={() => setConfirmDelete('closed')}
        />
      )}
    </MuscuLayout>
  )
}

interface ItemRowProps {
  item: Item
  /** Move by this many places (negative: up). */
  onMove: (steps: number) => void
  onEdit: () => void
  onRemove: () => void
  /** Relier en superset with the next exercise (absent: not possible). */
  onLink?: () => void
}

/**
 * Drag handle of a row (or ↑/↓ keys): each time the pointer travels half the row, it moves one place.
 * A superset is one row.
 */
function useReorderHandle(onMove: (steps: number) => void) {
  const row = useRef<HTMLLIElement>(null)
  const drag = useRef<{ y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const up = () => {
    drag.current = null
    setDragging(false)
  }
  return {
    row,
    dragging,
    handle: {
      onPointerDown(e: PointerEvent<HTMLButtonElement>) {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { y: e.clientY }
        setDragging(true)
      },
      onPointerMove(e: PointerEvent<HTMLButtonElement>) {
        if (!drag.current || !row.current) return
        const height = row.current.offsetHeight
        const delta = e.clientY - drag.current.y
        if (Math.abs(delta) > height / 2) {
          const steps = Math.sign(delta)
          drag.current.y += steps * height
          onMove(steps)
        }
      },
      onPointerUp: up,
      onPointerCancel: up,
      onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          onMove(e.key === 'ArrowUp' ? -1 : 1)
        }
      },
    },
  }
}

/** Thumbnail, name, "4 × 8–12" chip and link to the Fiche exercice (after the handle or the A/B badge). */
function ItemContent({ item, onEdit }: { item: Item; onEdit: () => void }) {
  return (
    <>
      <ExerciseThumb imageUrl={item.exercise.imageUrl} size="sm" />
      <span className={styles.itemText}>
        <span className={styles.itemName}>{item.exercise.name}</span>
        <span className={styles.itemMeta}>{primarySubtitle(item.exercise)}</span>
      </span>
      <button type="button" className={styles.chip} aria-label={fr.muscu.workout.edit(item.exercise.name)} onClick={onEdit}>
        {fr.muscu.setsReps(item.sets, item.repMin, item.repMax)}
      </button>
      {/* Fiche exercice (progression, history). Not part of the swipe. */}
      <Link
        to={exercisePath(item.exercise.id)}
        className={styles.open}
        aria-label={fr.muscu.workout.open(item.exercise.name)}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ChevronRight size={18} />
      </Link>
    </>
  )
}

/** One exercise: drag handle (or ↑/↓ keys), thumbnail, name, "4 × 8–12" chip; swipe left to remove. */
function ItemRow({ item, onMove, onEdit, onRemove, onLink }: ItemRowProps) {
  const { row, dragging, handle } = useReorderHandle(onMove)
  const swipe = useRef<{ x: number; dx: number } | null>(null)
  const [offset, setOffset] = useState(0)

  // Swipe to remove (horizontal only: vertical scrolling stays native).
  function onRowDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse') return
    swipe.current = { x: e.clientX, dx: 0 }
  }
  function onRowMove(e: PointerEvent<HTMLDivElement>) {
    if (!swipe.current) return
    const dx = Math.min(0, e.clientX - swipe.current.x)
    swipe.current.dx = dx
    setOffset(dx)
  }
  function onRowUp() {
    const removed = (swipe.current?.dx ?? 0) < -SWIPE_REMOVE_PX
    swipe.current = null
    setOffset(0)
    if (removed) onRemove()
  }

  return (
    <li ref={row} className={`${styles.item} ${dragging ? styles.dragging : ''}`}>
      <div
        className={styles.itemInner}
        // No transition while the finger moves the row; it slides back when released.
        style={offset ? { transform: `translateX(${offset}px)`, transition: 'none' } : undefined}
        onPointerDown={onRowDown}
        onPointerMove={onRowMove}
        onPointerUp={onRowUp}
        onPointerCancel={onRowUp}
      >
        <button
          type="button"
          className={styles.handle}
          aria-label={fr.muscu.workout.move(item.exercise.name)}
          {...handle}
        >
          <Grip />
        </button>
        <ItemContent item={item} onEdit={onEdit} />
      </div>
      {onLink && (
        <button type="button" className={styles.link} aria-label={fr.muscu.superset.link} onClick={onLink}>
          <LinkIcon />
        </button>
      )}
    </li>
  )
}

interface SupersetBlockProps {
  items: [Item, Item]
  /** Move the whole block by this many places (negative: up). */
  onMove: (steps: number) => void
  onEdit: (exerciseId: string) => void
  onUnlink: () => void
}

/** A superset: one block moved by its accent bar, Délier, and its two exercises with their A / B badges. */
function SupersetBlock({ items, onMove, onEdit, onUnlink }: SupersetBlockProps) {
  const { row, dragging, handle } = useReorderHandle(onMove)
  return (
    <li ref={row} className={`${styles.item} ${styles.superset} ${dragging ? styles.dragging : ''}`}>
      <button type="button" className={styles.blockHandle} aria-label={fr.muscu.superset.move} {...handle}>
        <span className={styles.bar} />
      </button>
      <div className={styles.blockBody}>
        <div className={styles.blockHead}>
          <span className={styles.supersetLabel}>{fr.muscu.superset.label}</span>
          <button type="button" className={styles.unlink} aria-label={fr.muscu.superset.unlinkLabel} onClick={onUnlink}>
            <LinkOff />
            {fr.muscu.superset.unlink}
          </button>
        </div>
        {items.map((item, index) => (
          <div key={item.exercise.id} className={styles.blockRow}>
            <SupersetBadge letter={index === 0 ? 'A' : 'B'} />
            <ItemContent item={item} onEdit={() => onEdit(item.exercise.id)} />
          </div>
        ))}
      </div>
    </li>
  )
}

interface ExercisePickerProps {
  workoutName: string
  inWorkout: Set<string>
  onAdd: (exercise: ExerciseDto) => void
  /** + Créer un exercice: a custom exercise, added to the workout once saved. */
  onCreate: () => void
  onClose: () => void
}

/** The bank in picking mode: "+" adds to the workout; exercises already in it show its name. */
function ExercisePicker({ workoutName, inWorkout, onAdd, onCreate, onClose }: ExercisePickerProps) {
  const exercises = useAsync(() => exercisesList(), 'exercises')
  return (
    <Sheet title={fr.muscu.exercises} onClose={onClose} dismiss="back" focusFirst={false}>
      <button type="button" className={styles.addExercise} onClick={onCreate}>
        {fr.muscu.workout.createExercise}
      </button>
      {exercises.status === 'error' && !exercises.data && (
        <div className={page.alert} role="alert">
          <span className={form.error}>{fr.common.loadError}</span>
          <button type="button" className={form.secondary} onClick={exercises.reload}>
            {fr.common.retry}
          </button>
        </div>
      )}
      {exercises.data && (
        <ExerciseSearchList
          exercises={exercises.data}
          linkRows={false}
          action={(exercise) =>
            inWorkout.has(exercise.id) ? (
              <span className={styles.inWorkout}>{workoutName}</span>
            ) : (
              <button
                type="button"
                className={styles.add}
                aria-label={fr.muscu.workout.add(exercise.name)}
                onClick={() => onAdd(exercise)}
              >
                <Plus size={18} />
              </button>
            )
          }
        />
      )}
    </Sheet>
  )
}
