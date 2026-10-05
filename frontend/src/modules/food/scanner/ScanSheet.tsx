import { normalizeBarcode } from '@healthmanager/shared'
import { useRef, useState, type FormEvent } from 'react'
import { foodsLookupBarcode } from '../../../api/generated/endpoints/foods/foods'
import type { FoodDto } from '../../../api/generated/model'
import { Sheet } from '../../../core/ui/Sheet'
import form from '../../../core/ui/form.module.css'
import { useIsDesktop } from '../../../core/useIsDesktop'
import { fr } from '../../../i18n/fr'
import { BarcodeCamera } from './BarcodeCamera'
import styles from './ScanSheet.module.css'

interface ScanSheetProps {
  onClose: () => void
  /** The product is known (or was just imported from Open Food Facts): ask the grams. */
  onFound: (food: FoodDto) => void
  /** Unknown product, or one without values: create "Mon aliment" with this barcode. */
  onMissing: (barcode: string, suggestedName: string | null) => void
}

type Status = 'idle' | 'searching' | 'invalid' | 'error'

/** After a failed lookup, the camera (still pointed at it) won't retry the same code before this. */
const RETRY_AFTER_MS = 3000

/** Scanner: camera on mobile, the typed barcode number on desktop (and as a fallback on mobile). */
export function ScanSheet({ onClose, onFound, onMissing }: ScanSheetProps) {
  const desktop = useIsDesktop()
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const lastFailure = useRef<{ code: string; at: number } | null>(null)

  async function lookup(code: string) {
    setStatus('searching')
    try {
      const result = await foodsLookupBarcode(code)
      if (result.food) onFound(result.food)
      else onMissing(code, result.suggestedName)
    } catch {
      lastFailure.current = { code, at: Date.now() }
      setStatus('error')
    }
  }

  function onDetected(code: string) {
    const failed = lastFailure.current
    if (failed && failed.code === code && Date.now() - failed.at < RETRY_AFTER_MS) return
    void lookup(code)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const code = normalizeBarcode(typed)
    if (code === null) setStatus('invalid')
    else void lookup(code)
  }

  return (
    <Sheet title={fr.scan.title} onClose={onClose} dismiss="back" focusFirst={desktop}>
      {!desktop && <BarcodeCamera paused={status === 'searching'} onDetected={onDetected} />}

      <form className={styles.form} onSubmit={submit}>
        <label className={form.field}>
          {fr.scan.barcode}
          <input
            className={form.input}
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            value={typed}
            aria-invalid={status === 'invalid'}
            onChange={(e) => {
              setTyped(e.target.value)
              if (status === 'invalid') setStatus('idle')
            }}
          />
        </label>
        <button className={form.secondary} type="submit" disabled={status === 'searching' || !typed.trim()}>
          {fr.scan.search}
        </button>
      </form>

      {(status === 'invalid' || status === 'error') && (
        <div className={form.error} role="alert">
          {status === 'invalid' ? fr.scan.invalid : fr.scan.error}
        </div>
      )}
    </Sheet>
  )
}
