import type { ExerciseDto } from '../../api/generated/model'
import { exerciseSubtitle, muscleSummary } from './format'

const ex = (p: ExerciseDto['primaryMuscles'], s: ExerciseDto['secondaryMuscles']): ExerciseDto => ({
  id: '1',
  name: 'X',
  equipment: 'barbell',
  primaryMuscles: p,
  secondaryMuscles: s,
  imageUrl: null,
})

describe('muscleSummary', () => {
  it('lists primary then secondary muscles, shoulder heads merged', () => {
    expect(exerciseSubtitle(ex(['chest'], ['triceps', 'shoulders_front']))).toBe('Pectoraux, triceps, épaules · Barre')
    expect(muscleSummary(ex(['shoulders_front'], ['triceps', 'shoulders_side']))).toBe('Épaules, triceps')
  })
})
