import { createContext, useContext } from 'react'

export interface ToastMessage {
  message: string
  action?: { label: string; onClick: () => void }
}

export const ToastContext = createContext<(toast: ToastMessage) => void>(() => {})

/** Shows a short message at the bottom of the screen, optionally with an action (Annuler). */
export const useToast = () => useContext(ToastContext)
