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
