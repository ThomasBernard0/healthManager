import { fr } from './fr'

/** Collects every string of the dictionary (functions called with a sample value). */
function strings(node: unknown): string[] {
  if (typeof node === 'string') return [node]
  if (typeof node === 'function') return [String(node('1'))]
  if (node && typeof node === 'object') return Object.values(node).flatMap(strings)
  return []
}

// Common English UI words that must never show up.
const ENGLISH = /\b(the|add|save|cancel|delete|undo|back|close|today|week|goal|meal|loading|error|retry|key|left|over)\b/i

describe('fr dictionary', () => {
  it('contains no English UI words', () => {
    const offenders = strings(fr).filter((s) => ENGLISH.test(s))
    expect(offenders).toEqual([])
  })
})
