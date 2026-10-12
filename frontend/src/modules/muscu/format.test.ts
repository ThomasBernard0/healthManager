import type { ExerciseDto } from '../../api/generated/model'
import {
  exerciseDetails,
  formatChartDate,
  formatHistoryDay,
  formatSetCell,
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
  sets: 4,
  repMin: 8,
  repMax: 12,
  imageVersion: null,
  workouts,
})

describe('muscu format', () => {
  it('lists primary then secondary muscles, shoulder heads merged', () => {
    expect(exerciseSubtitle(ex(['chest'], ['triceps', 'shoulders_front']))).toBe('Pectoraux, triceps, épaules · Barre')
    expect(muscleSummary(ex(['shoulders_front'], ['triceps', 'shoulders_side']))).toBe('Épaules, triceps')
    expect(primarySubtitle(ex(['back'], ['biceps']))).toBe('Dos · Barre')
  })

  it('shows the workouts of an exercise, then its sets and rep range (once)', () => {
    const pull = { id: 'p', name: 'Pull', programId: 'pp', programActive: true }
    expect(exerciseDetails(ex(['back'], [], [pull]))).toBe('Barre · Pull · 4 × 8–12')
    expect(exerciseDetails({ ...ex(['back'], [], [pull, { ...pull, id: 'b', name: 'Push B' }]), sets: 3, repMin: 6, repMax: 10 })).toBe(
      'Barre · Pull · Push B · 3 × 6–10',
    )
    expect(exerciseDetails(ex(['back'], []))).toBe('Barre · 4 × 8–12')
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

  it('bodyweight exercises: help, the body alone, added load', () => {
    const at = (weight: number, reps: number[]) => reps.map((r) => ({ weight, reps: r }))
    expect(formatSets(at(-20, [9, 9, 8, 8]), true)).toEqual(['Aide 20 kg × 9 · 9 · 8 · 8'])
    expect(formatSets(at(-4.5, [12, 12, 11, 10]), true)).toEqual(['Aide 4,5 kg × 12 · 12 · 11 · 10'])
    expect(formatSets(at(0, [9, 8, 8, 8]), true)).toEqual(['Poids du corps × 9 · 8 · 8 · 8'])
    expect(formatSets(at(5, [8, 8]), true)).toEqual(['5 kg × 8 · 8'])
    // Less help on the last set: a new line.
    expect(formatSets([...at(-9, [12, 12]), ...at(0, [6])], true)).toEqual(['Aide 9 kg × 12 · 12', 'Poids du corps × 6'])
    // Any other equipment: 0 kg stays a weight.
    expect(formatSets(at(0, [10]))).toEqual(['0 kg × 10'])
  })

  it('formats one set for a table cell', () => {
    expect(formatSetCell({ weight: 57.5, reps: 10 })).toBe('57,5 × 10')
    expect(formatSetCell({ weight: -20, reps: 9 })).toBe('Aide 20 × 9')
    expect(formatSetCell({ weight: 0, reps: 9 })).toBe('0 × 9')
  })
})

describe('formatTargets', () => {
  it('weight then each target, as on the desktop Accueil', () => {
    expect(formatTargets([12, 11, 11, 10].map((reps) => ({ weight: 55, reps })))).toBe('55 kg · 12 · 11 · 11 · 10')
    expect(formatTargets([{ weight: 62.5, reps: 8 }, { weight: 60, reps: 8 }])).toBe('62,5 kg · 8 / 60 kg · 8')
    expect(formatTargets([10, 10, 9, 9].map((reps) => ({ weight: -20, reps })))).toBe('Aide 20 kg · 10 · 10 · 9 · 9')
  })
})

describe('history dates', () => {
  it('formats chart and history dates', () => {
    expect(formatChartDate('2026-08-10')).toBe('10 août')
    expect(formatChartDate('2026-09-07')).toBe('7 sept')
    expect(formatHistoryDay('2026-09-28')).toBe('lun 28')
  })
})
