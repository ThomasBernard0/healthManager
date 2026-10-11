import type { ExerciseHistoryEntryDto, Feeling } from '../../../api/generated/model'
import { formatInt } from '../../../core/format'
import { fr } from '../../../i18n/fr'
import { formatHistoryDay, formatSessionDate, formatSets, formatWeight } from '../format'
import styles from './HistoryList.module.css'

const feelingClass = (f: Feeling | null) => (f === 'easy' ? styles.easy : f === 'hard' ? styles.hard : '')

interface HistoryListProps {
  /** Most recent first. */
  entries: ExerciseHistoryEntryDto[]
  variant?: 'mobile' | 'desktop'
}

/** Historique: date, sets in the compact format, feeling (desktop: a table). */
export function HistoryList({ entries, variant = 'mobile' }: HistoryListProps) {
  if (variant === 'desktop') return <HistoryTable entries={entries} />
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{fr.muscu.history.title}</h2>
      <ul className={styles.list}>
        {entries.map((e) => (
          <li key={e.sessionId} className={styles.row}>
            <span className={styles.date}>{formatHistoryDay(e.date)}</span>
            <span className={styles.sets}>
              {formatSets(e.sets).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
            <span className={`${styles.feeling} ${feelingClass(e.feeling)}`}>
              {e.feeling ? fr.muscu.session.feelings[e.feeling] : ''}
            </span>
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
            <th scope="col">{fr.muscu.history.volume}</th>
            <th scope="col" className={styles.end}>
              {fr.muscu.history.feeling}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.sessionId}>
              <td className={styles.dateCell}>
                {formatSessionDate(e.date)}
              </td>
              {Array.from({ length: columns }, (_, i) => (
                <td key={i}>{e.sets[i] ? `${formatWeight(e.sets[i].weight)} × ${e.sets[i].reps}` : ''}</td>
              ))}
              <td>{formatInt(e.volume)}</td>
              <td className={`${styles.end} ${feelingClass(e.feeling)}`}>
                {e.feeling ? fr.muscu.session.feelings[e.feeling] : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
