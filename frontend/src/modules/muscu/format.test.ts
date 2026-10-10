import type { ExerciseDto } from '../../api/generated/model'
import { exerciseDetails, exerciseSubtitle, formatSessionDate, muscleSummary, primarySubtitle } from './format'

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
