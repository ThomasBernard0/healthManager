import { useState } from 'react'
import type { SessionExerciseDto, SessionSetDto } from '../../api/generated/model'

/** How the weight of a bodyweight exercise is typed in a session: added load (Lest) or help from an assisted machine (Aide). */
export type LoadMode = 'load' | 'assist'

export const LOAD_MODES: readonly LoadMode[] = ['load', 'assist']

/** Aide when sets were already logged with help, else when today's targets are negative; Lest otherwise. */
export function initialLoadMode(sets: SessionSetDto[]): LoadMode {
  const logged = sets.find((s) => s.done && s.weight !== null && s.weight !== 0)
  if (logged) return logged.weight! < 0 ? 'assist' : 'load'
  return sets.some((s) => s.targetWeight !== null && s.targetWeight < 0) ? 'assist' : 'load'
}

/** The weight stored for a value typed in a mode: help is a negative weight. */
export const signedWeight = (typed: number, mode: LoadMode): number => (mode === 'assist' && typed !== 0 ? -typed : typed)

/** A set as its row shows it in a mode: every number positive; a target of the other mode is no target. */
export function setInMode(set: SessionSetDto, mode: LoadMode): SessionSetDto {
  const target = set.targetWeight
  const hasTarget = target !== null && (mode === 'assist' ? target <= 0 : target >= 0)
  return {
    ...set,
    targetWeight: hasTarget ? Math.abs(target) : null,
    targetReps: hasTarget ? set.targetReps : null,
    weight: set.weight === null ? null : Math.abs(set.weight),
  }
}

/**
 * Mode of an exercise in its session (null: not a bodyweight exercise, no Lest | Aide control). One mode per
 * exercise per session: `choose` sets it once the user picked one.
 */
export function useLoadMode(entry: SessionExerciseDto): [LoadMode | null, (mode: LoadMode | null) => void] {
  const [chosen, choose] = useState<LoadMode | null>(null)
  const mode = entry.exercise.equipment === 'bodyweight' ? (chosen ?? initialLoadMode(entry.sets)) : null
  return [mode, choose]
}

/** The sets already logged, to save again with the sign of the new mode. */
export function setsToFlip(sets: SessionSetDto[], mode: LoadMode): { index: number; weight: number; reps: number }[] {
  return sets
    .filter((s) => s.done && s.weight !== null && s.weight !== 0 && s.reps !== null)
    .map((s) => ({ index: s.index, weight: signedWeight(Math.abs(s.weight!), mode), reps: s.reps! }))
}
