import { useEffect, useRef, useState } from 'react'
import type { ExerciseHistoryEntryDto } from '../../../api/generated/model'
import { formatInt } from '../../../core/format'
import { fr } from '../../../i18n/fr'
import { formatChartDate, formatSessionDate, formatSets } from '../format'
import styles from './ProgressionChart.module.css'

interface ProgressionChartProps {
  /** Sessions to show, oldest first. */
  entries: ExerciseHistoryEntryDto[]
  variant?: 'mobile' | 'desktop'
}

/** Bars take the lower part of the plot, the weight line the upper part (no axis: shapes, values on tap). */
const BAR_MAX = 72
const LINE_TOP = 12
const LINE_BOTTOM = 52

/**
 * Progression: one bar per session = volume (Σ weight × reps), line = heaviest weight. No summary numbers:
 * tapping (or hovering) a bar highlights it and shows its date, sets and volume above it.
 */
export function ProgressionChart({ entries, variant = 'mobile' }: ProgressionChartProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const n = entries.length

  // Tap elsewhere hides the callout.
  useEffect(() => {
    if (selected === null) return
    const onPointer = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.('[data-bar]') || !root.current?.contains(e.target as Node)) setSelected(null)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [selected])

  const maxVolume = Math.max(1, ...entries.map((e) => e.volume))
  const weights = entries.map((e) => e.heaviest)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const x = (i: number) => ((i + 0.5) / n) * 100
  const y = (w: number) =>
    maxW === minW ? (LINE_TOP + LINE_BOTTOM) / 2 : LINE_BOTTOM - ((w - minW) / (maxW - minW)) * (LINE_BOTTOM - LINE_TOP)
  const shown = selected ?? hovered
  const labels = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 2 ? [0, 1] : [0]

  return (
    <section className={`${styles.card} ${variant === 'desktop' ? styles.desktop : ''}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>{fr.muscu.history.progression}</h2>
        <div className={styles.legend} aria-hidden="true">
          <span className={styles.key}>
            <span className={styles.lineKey} />
            {fr.muscu.history.load}
          </span>
          <span className={styles.key}>
            <span className={styles.barKey} />
            {fr.muscu.history.volume}
          </span>
        </div>
      </div>

      <div ref={root} className={styles.plot} role="group" aria-label={fr.muscu.history.chart}>
        <div className={styles.bars}>
          {entries.map((e, i) => (
            <button
              key={e.sessionId}
              type="button"
              data-bar
              className={styles.column}
              aria-label={fr.muscu.history.bar(formatSessionDate(e.date), formatInt(e.volume))}
              aria-pressed={selected === i}
              onClick={() => setSelected((s) => (s === i ? null : i))}
              onPointerEnter={(ev) => ev.pointerType === 'mouse' && setHovered(i)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
            >
              <span
                className={`${styles.bar} ${i === shown ? styles.barShown : i === n - 1 ? styles.barLast : ''}`}
                style={{ height: `${(e.volume / maxVolume) * BAR_MAX}%` }}
              />
            </button>
          ))}
        </div>

        <svg className={styles.line} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={entries.map((e, i) => `${x(i)},${y(e.heaviest)}`).join(' ')} vectorEffect="non-scaling-stroke" />
        </svg>
        {n > 0 && (
          <span className={styles.dot} style={{ left: `${x(n - 1)}%`, top: `${y(entries[n - 1].heaviest)}%` }} />
        )}

        {shown !== null && (
          <div
            className={styles.callout}
            // Kept inside the card near the edges.
            style={{ left: `${Math.min(80, Math.max(20, x(shown)))}%` }}
            role="status"
          >
            <div className={styles.calloutMuted}>{formatSessionDate(entries[shown].date)}</div>
            {formatSets(entries[shown].sets).map((line) => (
              <div key={line} className={styles.calloutStrong}>
                {line}
              </div>
            ))}
            <div className={styles.calloutMuted}>{fr.muscu.history.kg(formatInt(entries[shown].volume))}</div>
          </div>
        )}
      </div>

      <div className={styles.axis} aria-hidden="true">
        {labels.map((i) => (
          <span key={i}>{formatChartDate(entries[i].date)}</span>
        ))}
      </div>
    </section>
  )
}
