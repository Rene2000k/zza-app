import { dataAgeSeconds, relevantEntries } from '@/domain/board';
import { delayMinutes, headlineStation } from '@/domain/boardEntry';
import { displayableMessages } from '@/domain/message';
import { formatTrainRef } from '@/domain/train';
import { useBoard } from '@/hooks/useBoard';
import { useNow } from '@/hooks/useClock';
import type { DisplayConfig } from './config';
import type { BoardEntry } from '@/domain/boardEntry';

/**
 * Plain table of the current board — no design, on purpose.
 *
 * This is the smoke screen for the architecture: it proves data flows from provider
 * through the domain model into React without any design existing yet. The real
 * displays arrive as designs in a later phase and will not look like this.
 */
export const SmokeBoard = ({ config }: { config: DisplayConfig }) => {
  const now = useNow();
  const { board, isLoading, error, isRefreshing } = useBoard(config);

  if (isLoading) return <p>Lade Abfahrten…</p>;
  if (board === undefined) return <p role="alert">Keine Daten: {error?.message ?? 'unbekannt'}</p>;

  const entries = relevantEntries(board.entries, now, { horizonMinutes: config.horizonMinutes });
  const age = dataAgeSeconds(board, now);

  return (
    <section>
      <header>
        <h1>
          {board.station.name}
          {board.platform !== undefined ? ` · Gleis ${board.platform}` : ''}
        </h1>
        <p>
          <time>{formatTime(now)}</time> · Daten {age} s alt
          {isRefreshing ? ' · aktualisiert…' : ''}
          {error !== null ? ` · letzter Abruf fehlgeschlagen (${error.message})` : ''}
        </p>
      </header>

      {entries.length === 0 ? (
        <p>Keine Züge im Anzeigezeitraum.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Zug</th>
              <th>Nach / Von</th>
              <th>Gleis</th>
              <th>Status</th>
              <th>Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  {formatTime(entry.time.planned)}
                  {delayMinutes(entry.time) !== 0 ? ` (+${delayMinutes(entry.time)})` : ''}
                </td>
                <td>{formatTrainRef(entry.train)}</td>
                <td>{describeRoute(entry)}</td>
                <td>
                  {entry.platform.actual ?? '–'}
                  {entry.platform.changed ? ' (geändert)' : ''}
                </td>
                <td>{entry.status}</td>
                <td>
                  {displayableMessages(entry.messages)
                    .map((message) => message.text)
                    .join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

/** Terminating trains lead with where they came from (ADR-0003). */
const describeRoute = (entry: BoardEntry): string => {
  const headline = headlineStation(entry).name;
  if (entry.kind === 'terminatingArrival') return `von ${headline} · endet hier`;
  const via = entry.via.map((stop) => stop.name).join(', ');
  return via === '' ? headline : `${headline} — über ${via}`;
};

const timeFormat = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Europe/Berlin',
});

const formatTime = (instant: Date): string => timeFormat.format(instant);
