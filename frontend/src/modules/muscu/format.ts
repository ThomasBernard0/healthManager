import type { ExerciseDto, Muscle } from '../../api/generated/model'
import { groupSets, type SetResult } from '@healthmanager/shared'
import { formatDecimal, formatShortDay } from '../../core/format'
import { fr } from '../../i18n/fr'

const shortLabel = (m: Muscle): string => (m.startsWith('shoulders_') ? fr.muscu.shoulders : fr.muscu.muscles[m])

const sentence = (labels: string[]): string =>
  [...new Set(labels)].map((l, i) => (i === 0 ? l : l.toLocaleLowerCase('fr-FR'))).join(', ')

/** "Pectoraux, triceps": primary then secondary muscles, shoulder heads merged. */
export function muscleSummary(exercise: Pick<ExerciseDto, 'primaryMuscles' | 'secondaryMuscles'>): string {
  return sentence([...exercise.primaryMuscles, ...exercise.secondaryMuscles].map(shortLabel))
}

/** "Pectoraux, triceps · Barre" (Exercices list). */
export const exerciseSubtitle = (exercise: ExerciseDto): string =>
  `${muscleSummary(exercise)} · ${fr.muscu.equipment[exercise.equipment]}`

/** "Dos · Machine": primary muscles only (Modifier la séance). */
export const primarySubtitle = (exercise: ExerciseDto): string =>
  `${sentence(exercise.primaryMuscles.map(shortLabel))} · ${fr.muscu.equipment[exercise.equipment]}`

/** "Barre · Pull · 4 × 8–12" (Fiche exercice): equipment, then each workout it is part of. */
export const exerciseDetails = (exercise: ExerciseDto): string =>
  [
    fr.muscu.equipment[exercise.equipment],
    ...exercise.workouts.flatMap((w) => [w.name, fr.muscu.setsReps(w.sets, w.repMin, w.repMax)]),
  ].join(' · ')

/** "lun 28 sept" */
export const formatSessionDate = (date: string): string => {
  const s = formatShortDay(date)
  return s.charAt(0).toLocaleLowerCase('fr-FR') + s.slice(1)
}

/** "57,5" */
export const formatWeight = (kg: number): string => formatDecimal(kg)

/** Compact set format, one entry per weight: ["57,5 kg × 11 · 10", "55 kg × 10 · 9"]. */
export const formatSets = (sets: SetResult[]): string[] =>
  groupSets(sets).map((g) => fr.muscu.session.setGroup(formatWeight(g.weight), g.reps.join(' · ')))
