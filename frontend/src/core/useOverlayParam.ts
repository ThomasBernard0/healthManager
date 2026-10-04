import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

/**
 * A sheet/dialog driven by a search param (?name=value), so the back button closes it.
 * open() pushes a history entry; close() goes back to it (or clears the param on a deep link).
 */
export function useOverlayParam(name: string) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const value = params.get(name)

  const open = useCallback(
    (next: string) => {
      setParams((p) => {
        const copy = new URLSearchParams(p)
        copy.set(name, next)
        return copy
      })
    },
    [name, setParams],
  )

  const close = useCallback(() => {
    if (location.key !== 'default') {
      navigate(-1)
    } else {
      setParams(
        (p) => {
          const copy = new URLSearchParams(p)
          copy.delete(name)
          return copy
        },
        { replace: true },
      )
    }
  }, [location.key, name, navigate, setParams])

  return { value, open, close }
}
