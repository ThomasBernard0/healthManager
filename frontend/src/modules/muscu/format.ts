import type { ExerciseDto, Muscle } from '../../api/generated/model'
import { fr } from '../../i18n/fr'

const shortLabel = (m: Muscle): string => (m.startsWith('shoulders_') ? fr.muscu.shoulders : fr.muscu.muscles[m])

/** "Pectoraux, triceps": primary then secondary muscles, shoulder heads merged. */
export function muscleSummary(exercise: Pick<ExerciseDto, 'primaryMuscles' | 'secondaryMuscles'>): string {
  const labels = [...new Set([...exercise.primaryMuscles, ...exercise.secondaryMuscles].map(shortLabel))]
  return labels.map((l, i) => (i === 0 ? l : l.toLocaleLowerCase('fr-FR'))).join(', ')
}

/** "Pectoraux, triceps · Barre" (Exercices list). */
export const exerciseSubtitle = (exercise: ExerciseDto): string =>
  `${muscleSummary(exercise)} · ${fr.muscu.equipment[exercise.equipment]}`
