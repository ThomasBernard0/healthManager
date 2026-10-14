import { sessionPreFatigue, targetsFromHistory, type ExerciseStatus, type SessionEntry } from '@healthmanager/shared'
import type {
  ExerciseDto,
  ExerciseLogDto,
  FinishSessionDto,
  SessionBundleDto,
  SessionBundleExerciseDto,
  SessionSetDto,
} from '../../../api/generated/model'

/**
 * An exercise of the session on the phone: its bundle, and what was done. `preFatigue` is frozen with the
 * targets when its first set is validated (null: not started, targets still live).
 */
export interface LocalEntry extends SessionBundleExerciseDto {
  preFatigue: number | null
}

/** The session in progress, run on the phone from its bundle (the local copy). */
export interface LocalSession extends Omit<SessionBundleDto, 'exercises'> {
  exercises: LocalEntry[]
}

/** Exercice en cours: an exercise with its targets for today. */
export interface ExerciseView {
  id: string
  sessionId: string
  workoutName: string
  exercise: ExerciseDto
  repMin: number
  repMax: number
  easy: boolean
  completed: boolean
  /** Targets: live until the first set is validated, then frozen. */
  sets: SessionSetDto[]
  /** "Dernière fois": the last finished session with this exercise. */
  lastTime: ExerciseLogDto | null
  /** Superset: the exercise it alternates with (null: solo). */
  partnerId: string | null
}

const time = (iso: string | null) => (iso === null ? null : Date.parse(iso))

function toEntry(e: SessionBundleExerciseDto): SessionEntry {
  const times = e.sets.filter((s) => s.done && s.doneAt !== null).map((s) => time(s.doneAt)!)
  return {
    id: e.id,
    firstSetAt: times.length > 0 ? Math.min(...times) : null,
    exercise: e.exercise,
    sets: e.sets.map((s) => ({ done: s.done, doneAt: time(s.doneAt) })),
  }
}

/** Sets of the other exercises validated before its first set (all of them while it is not started). */
function fatigueOf(session: { exercises: SessionBundleExerciseDto[] }, entry: SessionBundleExerciseDto): number {
  return sessionPreFatigue(toEntry(entry), session.exercises.map(toEntry)).value
}

function targetsOf(entry: SessionBundleExerciseDto, todayPreFatigue: number) {
  return targetsFromHistory(entry.history, {
    setCount: entry.sets.length,
    repMin: entry.repMin,
    repMax: entry.repMax,
    known: entry.knownWeights,
    step: entry.step,
    todayPreFatigue,
    todayInSuperset: entry.supersetGroup !== null,
  })
}

/** The local copy of a session from its bundle (an exercise already started there keeps its targets). */
export function fromBundle(bundle: SessionBundleDto): LocalSession {
  return {
    ...bundle,
    exercises: bundle.exercises.map((e) => ({
      ...e,
      preFatigue: e.sets.some((s) => s.done) ? fatigueOf(bundle, e) : null,
    })),
  }
}

export function entryStatus(e: { completed: boolean; sets: { done: boolean }[] }): ExerciseStatus {
  if (e.completed) return 'done'
  return e.sets.some((s) => s.done) ? 'inProgress' : 'todo'
}

/** The other exercise of its superset. */
export function partnerOf<E extends { id: string; supersetGroup: string | null }>(entry: E, entries: E[]): E | null {
  if (entry.supersetGroup === null) return null
  return entries.find((e) => e.id !== entry.id && e.supersetGroup === entry.supersetGroup) ?? null
}

/** Exercice en cours, with its targets: computed now with the shared functions until its first set, then frozen. */
export function exerciseView(session: LocalSession, entryId: string): ExerciseView | null {
  const entry = session.exercises.find((e) => e.id === entryId)
  if (!entry) return null
  const live = entry.preFatigue === null ? targetsOf(entry, fatigueOf(session, entry)) : null
  return {
    id: entry.id,
    sessionId: session.id,
    workoutName: session.workoutName,
    exercise: entry.exercise,
    repMin: entry.repMin,
    repMax: entry.repMax,
    easy: entry.easy,
    completed: entry.completed,
    sets:
      entry.preFatigue === null
        ? entry.sets.map((s, i) => ({ ...s, targetWeight: live?.[i]?.weight ?? null, targetReps: live?.[i]?.reps ?? null }))
        : entry.sets,
    lastTime: entry.history[0] ?? null,
    partnerId: partnerOf(entry, session.exercises)?.id ?? null,
  }
}

const withEntry = (session: LocalSession, id: string, change: (e: LocalEntry) => LocalEntry): LocalSession => ({
  ...session,
  exercises: session.exercises.map((e) => (e.id === id ? change(e) : e)),
})

/** First set of an exercise: its pre-fatigue and the targets of every set are fixed now. */
function freeze(session: LocalSession, entry: LocalEntry): LocalEntry {
  const preFatigue = fatigueOf(session, entry)
  const targets = targetsOf(entry, preFatigue)
  return {
    ...entry,
    preFatigue,
    sets: entry.sets.map((s, i) => ({ ...s, targetWeight: targets?.[i]?.weight ?? null, targetReps: targets?.[i]?.reps ?? null })),
  }
}

export interface SetChange {
  weight: number | null
  reps: number | null
  /** true: ✓ (empty values record the target); false: reopens the row. */
  done: boolean
}

/**
 * ✓ on a set row, in order: empty values record the target, done = false reopens any row. A set already done
 * keeps its time when saved again (Lest ↔ Aide), so the order of the exercises doesn't change.
 */
export function saveSet(
  session: LocalSession,
  entryId: string,
  index: number,
  change: SetChange,
  now = new Date(),
): LocalSession {
  const found = session.exercises.find((e) => e.id === entryId)
  const row = found?.sets.find((s) => s.index === index)
  if (!found || !row) throw new Error('Set not found')
  if (change.done && !row.done && found.sets.some((s) => s.index < index && !s.done)) {
    throw new Error('Validate the sets in order')
  }
  const entry = found.preFatigue === null ? freeze(session, found) : found
  const sets = entry.sets.map((s): SessionSetDto => {
    if (s.index !== index) return s
    if (!change.done) return { ...s, weight: change.weight, reps: change.reps, done: false, doneAt: null }
    const weight = change.weight ?? s.targetWeight
    const reps = change.reps ?? s.targetReps
    if (weight === null || reps === null) throw new Error('weight and reps are required (no target)')
    return { ...s, weight, reps, done: true, doneAt: s.done && s.doneAt ? s.doneAt : now.toISOString() }
  })
  const started = sets.some((s) => s.done)
  return withEntry(session, entryId, () => ({ ...entry, sets, completed: started && entry.completed }))
}

/** Facile and/or Terminé (Terminé needs a validated set). */
export function updateExercise(
  session: LocalSession,
  entryId: string,
  change: { easy?: boolean; completed?: boolean },
): LocalSession {
  return withEntry(session, entryId, (e) => ({
    ...e,
    ...(change.easy !== undefined ? { easy: change.easy } : {}),
    ...(change.completed !== undefined ? { completed: change.completed && e.sets.some((s) => s.done) } : {}),
  }))
}

/** Terminer la séance: the whole session in one request. */
export function finishBody(session: LocalSession): FinishSessionDto {
  return {
    exercises: session.exercises.map((e) => ({
      id: e.id,
      easy: e.easy,
      completed: e.completed,
      sets: e.sets.map((s) => ({
        index: s.index,
        targetWeight: s.targetWeight,
        targetReps: s.targetReps,
        weight: s.done ? s.weight : null,
        reps: s.done ? s.reps : null,
        done: s.done,
        doneAt: s.done ? s.doneAt : null,
      })),
    })),
  }
}
