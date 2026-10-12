import { useState } from 'react'
import { programsActivate } from '../../api/generated/endpoints/programs/programs'
import { invalidateData } from '../../core/dataVersion'

/** Activer: the only active program from now on (its rotation restarts at its first séance). */
export function useActivateProgram() {
  /** The program being activated. */
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState(false)
  async function activate(id: string): Promise<boolean> {
    setBusy(id)
    setError(false)
    try {
      await programsActivate(id)
    } catch {
      setError(true)
      return false
    } finally {
      setBusy(null)
    }
    invalidateData()
    return true
  }
  return { activate, busy, error }
}
