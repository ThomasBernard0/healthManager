import type { ExerciseHistoryEntryDto } from '../../../api/generated/model'
import { formatInt } from '../../../core/format'
import { Bolt, LinkIcon } from '../../../core/ui/icons'
import { fr } from '../../../i18n/fr'
import { formatHistoryDay, formatSessionDate, formatSetCell, formatSets } from '../format'
import styles from './HistoryList.module.css'

/** Small link icon next to the date of a session done in a superset. */
const SupersetMark = () => (
  <span className={styles.mark} role="img" aria-label={fr.muscu.superset.inHistory}>
    <LinkIcon size={12} />
  </span>
)

interface HistoryListProps {
  /** Most recent first. */
  entries: ExerciseHistoryEntryDto[]
  variant?: 'mobile' | 'desktop'
}

/** A bodyweight exercise: its sets read "Aide 20 kg" / "Poids du corps", and its bars are total reps. */
const inReps = (entries: ExerciseHistoryEntryDto[]) => entries.some((e) => e.barKind === 'reps')

/** Historique: date, sets in the compact format, "Facile" when it was tapped (desktop: a table). */
export function HistoryList({ entries, variant = 'mobile' }: HistoryListProps) {
  if (variant === 'desktop') return <HistoryTable entries={entries} />
  const bodyweight = inReps(entries)
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{fr.muscu.history.title}</h2>
      <ul className={styles.list}>
        {entries.map((e) => (
          <li key={e.sessionId} className={styles.row}>
            <span className={styles.date}>
              {formatHistoryDay(e.date)}
              {e.inSuperset && <SupersetMark />}
            </span>
            <span className={styles.sets}>
              {formatSets(e.sets, bodyweight).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
            {e.easy && <span className={styles.easy}>{fr.muscu.session.easy}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function HistoryTable({ entries }: { entries: ExerciseHistoryEntryDto[] }) {
  const columns = Math.max(...entries.map((e) => e.sets.length))
  return (
    <section className={styles.tableCard}>
      <table className={styles.table}>
        <caption className={styles.caption}>{fr.muscu.history.title}</caption>
        <thead>
          <tr>
            <th scope="col">{fr.muscu.history.date}</th>
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} scope="col">
                {fr.muscu.history.set(i + 1)}
              </th>
            ))}
            <th scope="col">{inReps(entries) ? fr.muscu.history.reps : fr.muscu.history.volume}</th>
            <th scope="col" className={styles.end}>
              {fr.muscu.session.easy}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.sessionId}>
              <td className={styles.dateCell}>
                <span className={styles.dateWithMark}>
                  {formatSessionDate(e.date)}
                  {e.inSuperset && <SupersetMark />}
                </span>
              </td>
              {Array.from({ length: columns }, (_, i) => (
                <td key={i}>{e.sets[i] ? formatSetCell(e.sets[i]) : ''}</td>
              ))}
              <td>{formatInt(e.barValue)}</td>
              <td className={styles.end}>
                {e.easy && (
                  <span className={styles.easyMark} role="img" aria-label={fr.muscu.session.easy}>
                    <Bolt size={14} strokeWidth={2.2} />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
