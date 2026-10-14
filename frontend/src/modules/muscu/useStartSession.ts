import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionsCurrent, sessionsStart } from '../../api/generated/endpoints/sessions/sessions'
import { isNetworkError } from '../../api/http'
import { invalidateData } from '../../core/dataVersion'
import { storeBundle } from './offline/store'
import { sessionPath } from './routes'

/**
 * Démarrer: starts the workout, keeps its bundle and pictures on the device (the session then runs without
 * the network) and opens the session list. If a session is already in progress (started on another device),
 * opens that one instead.
 */
export function useStartSession() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'idle' | 'busy' | 'error' | 'offline'>('idle')

  async function start(workoutId: string) {
    setStatus('busy')
    try {
      const session = await storeBundle(await sessionsStart({ workoutId }))
      invalidateData()
      navigate(sessionPath(session.id))
    } catch (error) {
      if (isNetworkError(error)) {
        setStatus('offline')
        return
      }
      const { session } = await sessionsCurrent().catch(() => ({ session: null }))
      if (session) navigate(sessionPath(session.id))
      else setStatus('error')
    }
  }

  return { start, status }
}
