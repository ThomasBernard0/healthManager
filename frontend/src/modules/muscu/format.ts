import type { ExerciseDto, Muscle } from '../../api/generated/model'
import { groupSets, loadKind, toUtcDate, type SetResult } from '@healthmanager/shared'
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

/** "Barre · Pull · 4 × 8–12" (Fiche exercice): equipment, the workouts it is part of, its sets and rep range. */
export const exerciseDetails = (exercise: ExerciseDto): string =>
  [
    fr.muscu.equipment[exercise.equipment],
    ...exercise.workouts.map((w) => w.name),
    fr.muscu.setsReps(exercise.sets, exercise.repMin, exercise.repMax),
  ].join(' · ')

/** "lun 28 sept" */
export const formatSessionDate = (date: string): string => {
  const s = formatShortDay(date)
  return s.charAt(0).toLocaleLowerCase('fr-FR') + s.slice(1)
}

/** "57,5" */
export const formatWeight = (kg: number): string => formatDecimal(kg)

/**
 * Compact set format, one entry per weight: ["57,5 kg × 11 · 10", "55 kg × 10 · 9"]. Bodyweight exercises:
 * "Aide 20 kg × 9 · 9" with help, "Poids du corps × 9 · 8" at 0 kg.
 */
export const formatSets = (sets: SetResult[], bodyweight = false): string[] =>
  groupSets(sets).map((g) => {
    const reps = g.reps.join(' · ')
    switch (loadKind(g.weight, bodyweight)) {
      case 'assist':
        return fr.muscu.session.assistGroup(formatWeight(-g.weight), reps)
      case 'bodyweight':
        return fr.muscu.session.bodyweightGroup(reps)
      case 'load':
        return fr.muscu.session.setGroup(formatWeight(g.weight), reps)
    }
  })

/** One set in a table cell: "60 × 10", with help "Aide 20 × 9". */
export const formatSetCell = (set: SetResult): string =>
  set.weight < 0
    ? fr.muscu.history.assistSet(formatWeight(-set.weight), set.reps)
    : `${formatWeight(set.weight)} × ${set.reps}`

/**
 * Targets on one line, as on the desktop Accueil: "55 kg · 12 · 11 · 11 · 10" (" / " between weights); with help
 * "Aide 20 kg · 10 · 10 · 9 · 9".
 */
export const formatTargets = (targets: SetResult[]): string =>
  groupSets(targets)
    .map((g) => {
      const weight =
        g.weight < 0
          ? fr.muscu.session.assistWeight(formatWeight(-g.weight))
          : `${formatWeight(g.weight)} ${fr.muscu.session.kg}`
      return [weight, ...g.reps].join(' · ')
    })
    .join(' / ')

const noDot = (s: string) => s.replace(/\.$/, '')
const dayShortMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const shortWeekdayDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

/** "10 août", "7 sept" (chart axis). */
export const formatChartDate = (date: string): string =>
  dayShortMonth
    .formatToParts(toUtcDate(date))
    .map((p) => (p.type === 'month' ? noDot(p.value) : p.value))
    .join('')

/** "lun 28" (history rows on mobile). */
export const formatHistoryDay = (date: string): string => noDot(shortWeekdayDay.format(toUtcDate(date)).replace('.', ''))
