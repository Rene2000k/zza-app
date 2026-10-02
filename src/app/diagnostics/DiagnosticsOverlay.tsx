import { useEffect, useState, useSyncExternalStore } from 'react';
import { useDiagnosticsLog } from './DiagnosticsContext';
import styles from './DiagnosticsOverlay.module.css';
import { formatDuration } from './diagnosticsLog';
import { isShortcut } from '../shortcuts';
import type { DiagnosticsLog, DiagnosticsSnapshot } from './diagnosticsLog';
import type { DisplayConfig } from '../config';
import type { ZzaBoardViewModel } from '@/hooks/useZzaBoard';

/** Entries shown, newest first; the rest stays in memory and on the console. */
const SHOWN_ENTRIES = 50;

/** The key that shows and hides the view — "d" for diagnostics. */
const isDiagnosticsKey = (event: KeyboardEvent): boolean => isShortcut(event, 'd');

export interface DiagnosticsOverlayProps {
  readonly config: DisplayConfig;
  readonly board: ZzaBoardViewModel;
}

/**
 * The hidden debug view, toggled with "d": when data last arrived, what failed and how,
 * how long the worst outage was, and the train on screen as the domain model has it.
 *
 * Laid over the display rather than replacing it, so the picture and its explanation can be
 * compared. It shows the domain model, not the source's raw response: the source format
 * stays inside its provider, and the domain model is what the design actually got.
 */
export const DiagnosticsOverlay = ({ config, board }: DiagnosticsOverlayProps) => {
  const log = useDiagnosticsLog();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isDiagnosticsKey(event)) setOpen((current) => !current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open || log === null) return null;
  return <OverlayContent log={log} config={config} board={board} />;
};

/** Split off so the log is only subscribed to while the view is open. */
const OverlayContent = ({
  log,
  config,
  board,
}: DiagnosticsOverlayProps & { readonly log: DiagnosticsLog }) => {
  const snapshot = useSyncExternalStore(log.subscribe, log.getSnapshot);

  return (
    <aside
      className={styles.overlay}
      aria-label="Diagnose"
      // A double-click here selects text; it must not reach the frame and toggle fullscreen.
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <h2>Diagnose</h2>
      <dl className={styles.facts}>
        <dt>Konfiguration</dt>
        <dd>
          {config.provider} · Bahnhof {config.station} · Gleis {config.platform ?? 'alle'} ·{' '}
          {config.design} · alle {config.refreshSeconds} s
        </dd>
        <dt>Läuft seit</dt>
        <dd>{formatTime(snapshot.startedAt)}</dd>
        <dt>Letzter Abruf ok</dt>
        <dd>{snapshot.lastSuccessAt === undefined ? '—' : formatTime(snapshot.lastSuccessAt)}</dd>
        <dt>Datenalter</dt>
        <dd>{board.state === 'ready' ? `${board.dataAgeSeconds} s` : board.state}</dd>
        <dt>Letzter Fehler</dt>
        <dd>
          {snapshot.lastError === undefined
            ? '—'
            : `${formatTime(snapshot.lastError.at)} — ${snapshot.lastError.message}`}
        </dd>
        <dt>Abrufe</dt>
        <dd>
          {snapshot.successes} ok · {snapshot.failures} fehlgeschlagen
        </dd>
        <dt>Ausfall</dt>
        <dd>{describeOutages(snapshot)}</dd>
      </dl>

      <h3>Aktueller Zug</h3>
      <pre className={styles.raw}>
        {board.state === 'ready' && board.current !== undefined
          ? JSON.stringify(board.current, null, 2)
          : '—'}
      </pre>

      <h3>Ereignisse</h3>
      <ol className={styles.entries}>
        {snapshot.entries
          .slice(-SHOWN_ENTRIES)
          .reverse()
          .map((entry) => (
            <li key={entry.seq} className={styles[entry.level]}>
              {formatTime(entry.at)} {entry.text}
            </li>
          ))}
      </ol>
    </aside>
  );
};

const describeOutages = (snapshot: DiagnosticsSnapshot): string => {
  const parts: string[] = [];
  if (snapshot.outageSince !== undefined) {
    parts.push(
      `läuft seit ${formatTime(snapshot.outageSince)} (${snapshot.failureStreak} Fehlversuche)`,
    );
  }
  const longest = snapshot.longestOutage;
  if (longest !== undefined) {
    parts.push(
      `längster: ${formatDuration(longest.to.getTime() - longest.from.getTime())}, ` +
        `${formatTime(longest.from)}–${formatTime(longest.to)}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'keiner';
};

/** Day and time: an overnight log needs the day to be read correctly. */
const formatTime = (at: Date): string =>
  at.toLocaleString('de-DE', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
