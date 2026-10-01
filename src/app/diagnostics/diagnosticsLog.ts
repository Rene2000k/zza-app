import { ProviderError } from '@/providers/errors';
import { systemClock } from '@/platform/clock';
import type { Clock } from '@/platform/clock';

/** Entries kept in memory; older ones fall out. A day of failed 30-s polls fits easily. */
export const LOG_CAPACITY = 300;

/** Every line on the console starts with this, so it can be filtered out of a browser log. */
export const CONSOLE_PREFIX = '[zza]';

export type LogLevel = 'info' | 'warn';

export interface LogEntry {
  /** Running number since start; identifies an entry while older ones fall out. */
  readonly seq: number;
  readonly at: Date;
  readonly level: LogLevel;
  readonly text: string;
}

export interface Outage {
  readonly from: Date;
  readonly to: Date;
  /** Failed polls during the outage. */
  readonly failures: number;
}

/** What the debug view shows; replaced as a whole on every change. */
export interface DiagnosticsSnapshot {
  readonly startedAt: Date;
  readonly successes: number;
  readonly failures: number;
  readonly lastSuccessAt: Date | undefined;
  readonly lastError: { readonly at: Date; readonly message: string } | undefined;
  /** Start of the outage still going on, if any. */
  readonly outageSince: Date | undefined;
  /** Failed polls in the outage still going on. */
  readonly failureStreak: number;
  readonly longestOutage: Outage | undefined;
  /** Oldest first. */
  readonly entries: readonly LogEntry[];
}

/** Function properties rather than methods: they are handed around unbound (`useSyncExternalStore`). */
export interface DiagnosticsLog {
  readonly boardSucceeded: () => void;
  readonly boardFailed: (error: unknown) => void;
  readonly note: (level: LogLevel, text: string) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => DiagnosticsSnapshot;
}

/** Where entries go besides memory: the browser console, unless a test says otherwise. */
export type LogSink = (entry: LogEntry) => void;

const consoleSink: LogSink = (entry) => {
  const line = `${CONSOLE_PREFIX} ${entry.at.toISOString()} ${entry.text}`;
  if (entry.level === 'warn') console.warn(line);
  else console.info(line);
};

/**
 * The display's flight recorder: counters and a bounded event log, so that "the display was
 * empty last night" can be traced back to a cause — the source answering 503, the network
 * gone, a timeout — after the display has long recovered.
 *
 * Kept in memory for the debug view and written to the browser console line by line. Memory
 * does not survive a reload (and the outage watchdog reloads exactly after long outages);
 * the console does, where the browser is told to keep it — Chromium as a kiosk started with
 * `--enable-logging=stderr` hands it to the system log.
 *
 * Only failures and transitions are logged, not every successful poll: a healthy day would
 * otherwise push the interesting entries out of the buffer within hours.
 *
 * Timestamps are real time from the system clock even when the display runs a simulated
 * clock: a log is compared with the outside world, not with the board.
 */
export const createDiagnosticsLog = (
  clock: Clock = systemClock,
  sink: LogSink = consoleSink,
): DiagnosticsLog => {
  const listeners = new Set<() => void>();
  let seq = 0;
  let snapshot: DiagnosticsSnapshot = {
    startedAt: clock.now(),
    successes: 0,
    failures: 0,
    lastSuccessAt: undefined,
    lastError: undefined,
    outageSince: undefined,
    failureStreak: 0,
    longestOutage: undefined,
    entries: [],
  };

  const update = (next: Partial<DiagnosticsSnapshot>, entry?: Omit<LogEntry, 'seq' | 'at'>) => {
    let entries = snapshot.entries;
    if (entry !== undefined) {
      seq += 1;
      const logged: LogEntry = { seq, at: clock.now(), ...entry };
      entries = [...entries, logged].slice(-LOG_CAPACITY);
      sink(logged);
    }
    snapshot = { ...snapshot, ...next, entries };
    for (const listener of listeners) listener();
  };

  return {
    boardSucceeded: () => {
      const now = clock.now();
      const { outageSince, failureStreak, longestOutage } = snapshot;
      if (outageSince === undefined) {
        update({ successes: snapshot.successes + 1, lastSuccessAt: now });
        return;
      }
      const outage: Outage = { from: outageSince, to: now, failures: failureStreak };
      update(
        {
          successes: snapshot.successes + 1,
          lastSuccessAt: now,
          outageSince: undefined,
          failureStreak: 0,
          longestOutage:
            longestOutage === undefined || durationMs(outage) > durationMs(longestOutage)
              ? outage
              : longestOutage,
        },
        {
          level: 'info',
          text: `Daten wieder da nach ${formatDuration(durationMs(outage))} (${failureStreak} Fehlversuche)`,
        },
      );
    },

    boardFailed: (error) => {
      const now = clock.now();
      const message = describeError(error);
      update(
        {
          failures: snapshot.failures + 1,
          lastError: { at: now, message },
          outageSince: snapshot.outageSince ?? now,
          failureStreak: snapshot.failureStreak + 1,
        },
        { level: 'warn', text: `Abruf fehlgeschlagen: ${message}` },
      );
    },

    note: (level, text) => update({}, { level, text }),

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot: () => snapshot,
  };
};

/** One line on what went wrong; the HTTP status first where the source answered at all. */
export const describeError = (error: unknown): string => {
  if (error instanceof ProviderError && error.status !== undefined) {
    return `HTTP ${error.status} — ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unbekannter Fehler';
};

const durationMs = (outage: Outage): number => outage.to.getTime() - outage.from.getTime();

/** "45 s", "12 min", "2 h 5 min" — precise enough to match against an evening. */
export const formatDuration = (ms: number): string => {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};
