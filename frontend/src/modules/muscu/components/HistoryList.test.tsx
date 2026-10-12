import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ExerciseHistoryEntryDto } from '../../../api/generated/model'
import { HistoryList } from './HistoryList'

const entry = (sessionId: string, date: string, easy: boolean): ExerciseHistoryEntryDto => ({
  sessionId,
  date,
  sets: [10, 9].map((reps) => ({ weight: 60, reps })),
  easy,
  preFatigue: 0,
  inSuperset: false,
  volume: 1140,
  heaviest: 60,
  barKind: 'volume',
  barValue: 1140,
})

describe('HistoryList (desktop table), bodyweight exercise', () => {
  it('the volume column becomes Reps; sets done with help read "Aide"', () => {
    const assisted: ExerciseHistoryEntryDto = {
      ...entry('s1', '2026-10-08', false),
      sets: [9, 9, 8, 8].map((reps) => ({ weight: -20, reps })),
      volume: -680,
      heaviest: -20,
      barKind: 'reps',
      barValue: 34,
    }
    render(<HistoryList variant="desktop" entries={[assisted]} />)

    expect(screen.getByRole('columnheader', { name: 'Reps' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Volume' })).toBeNull()
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
    expect(cells.map((c) => c.textContent)).toEqual(['jeu 8 oct', 'Aide 20 × 9', 'Aide 20 × 9', 'Aide 20 × 8', 'Aide 20 × 8', '34', ''])
  })
})

describe('HistoryList (desktop table)', () => {
  it('has a Facile column: a bolt when it was tapped, else empty', () => {
    render(<HistoryList variant="desktop" entries={[entry('s2', '2026-09-28', true), entry('s1', '2026-09-21', false)]} />)

    expect(screen.getByRole('columnheader', { name: 'Facile' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Ressenti' })).toBeNull()
    const [, tapped, not] = screen.getAllByRole('row')
    expect(within(tapped).getByRole('img', { name: 'Facile' })).toBeInTheDocument()
    expect(within(not).queryByRole('img', { name: 'Facile' })).toBeNull()
    expect(within(not).getAllByRole('cell').at(-1)).toBeEmptyDOMElement()
  })
})
