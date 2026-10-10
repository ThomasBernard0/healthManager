import type { ExerciseDto } from '../../api/generated/model'
import {
  exerciseDetails,
  formatChartDate,
  formatHistoryDay,
  exerciseSubtitle,
  formatSessionDate,
  formatSets,
  formatTargets,
  muscleSummary,
  primarySubtitle,
} from './format'

const ex = (
  p: ExerciseDto['primaryMuscles'],
  s: ExerciseDto['secondaryMuscles'],
  workouts: ExerciseDto['workouts'] = [],
): ExerciseDto => ({
  id: '1',
  name: 'X',
  equipment: 'barbell',
  primaryMuscles: p,
  secondaryMuscles: s,
  imageUrl: null,
  workouts,
})

describe('muscu format', () => {
  it('lists primary then secondary muscles, shoulder heads merged', () => {
    expect(exerciseSubtitle(ex(['chest'], ['triceps', 'shoulders_front']))).toBe('Pectoraux, triceps, épaules · Barre')
    expect(muscleSummary(ex(['shoulders_front'], ['triceps', 'shoulders_side']))).toBe('Épaules, triceps')
    expect(primarySubtitle(ex(['back'], ['biceps']))).toBe('Dos · Barre')
  })

  it('shows the workouts of an exercise with their sets and rep range', () => {
    expect(exerciseDetails(ex(['back'], [], [{ id: 'p', name: 'Pull', sets: 4, repMin: 8, repMax: 12 }]))).toBe(
      'Barre · Pull · 4 × 8–12',
    )
    expect(exerciseDetails(ex(['back'], []))).toBe('Barre')
  })

  it('formats a session date', () => {
    expect(formatSessionDate('2026-09-28')).toBe('lun 28 sept')
  })
})

describe('formatSets', () => {
  it('groups consecutive sets at the same weight, a weight change starts a new line', () => {
    expect(formatSets([10, 9, 9, 8].map((reps) => ({ weight: 60, reps })))).toEqual(['60 kg × 10 · 9 · 9 · 8'])
    expect(
      formatSets([
        { weight: 57.5, reps: 11 },
        { weight: 57.5, reps: 10 },
        { weight: 55, reps: 10 },
        { weight: 55, reps: 9 },
      ]),
    ).toEqual(['57,5 kg × 11 · 10', '55 kg × 10 · 9'])
  })
})

describe('formatTargets', () => {
  it('weight then each target, as on the desktop Accueil', () => {
    expect(formatTargets([12, 11, 11, 10].map((reps) => ({ weight: 55, reps })))).toBe('55 kg · 12 · 11 · 11 · 10')
    expect(formatTargets([{ weight: 62.5, reps: 8 }, { weight: 60, reps: 8 }])).toBe('62,5 kg · 8 / 60 kg · 8')
  })
})

describe('history dates', () => {
  it('formats chart and history dates', () => {
    expect(formatChartDate('2026-08-10')).toBe('10 août')
    expect(formatChartDate('2026-09-07')).toBe('7 sept')
    expect(formatHistoryDay('2026-09-28')).toBe('lun 28')
  })
})
