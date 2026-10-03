import { isSamePlatform } from './station';
import type { BoardEntry } from './boardEntry';
import type { StationRef } from './station';

/** What a provider returns for one station (optionally one platform). */
export interface StationBoard {
  readonly station: StationRef;
  /** Platform the board was filtered to, if any. */
  readonly platform?: string;
  readonly entries: readonly BoardEntry[];
  /** When this data was produced, per the clock — the basis for staleness. */
  readonly fetchedAt: Date;
}

/**
 * How old the data is, in seconds, measured against the clock rather than the
 * system time so that a demo clock and its fixtures stay consistent (ADR-0004).
 */
export const dataAgeSeconds = (board: StationBoard, now: Date): number =>
  Math.max(0, Math.round((now.getTime() - board.fetchedAt.getTime()) / 1000));

/**
 * True once the data is older than `staleAfterSeconds` — the point from which a display
 * may say so instead of silently showing old departures. The threshold is the polling
 * policy's to set, not the design's.
 */
export const isStale = (board: StationBoard, now: Date, staleAfterSeconds: number): boolean =>
  dataAgeSeconds(board, now) > staleAfterSeconds;

/**
 * Entries a display should still show: nothing that left more than
 * `keepPastMinutes` ago, and nothing further out than `horizonMinutes`.
 *
 * A real display keeps a departed train up briefly, which is why the past window
 * exists rather than cutting at "now".
 */
export const relevantEntries = (
  entries: readonly BoardEntry[],
  now: Date,
  { keepPastMinutes = 1, horizonMinutes = 120 } = {},
): BoardEntry[] => {
  const from = now.getTime() - keepPastMinutes * 60_000;
  const to = now.getTime() + horizonMinutes * 60_000;
  return entries.filter((entry) => {
    const at = entry.time.expected.getTime();
    return at >= from && at <= to;
  });
};

/**
 * Entries relevant to one platform's board: those actually running from it now, and
 * those that were planned there and later moved elsewhere.
 *
 * A platform must keep announcing a train that left it — dropping the entry the moment
 * it changes platform looks like a data failure, not a deliberate change (ADR-0006).
 */
export const entriesForPlatform = (
  entries: readonly BoardEntry[],
  platform: string,
): BoardEntry[] =>
  entries.filter(
    (entry) =>
      isSamePlatform(entry.platform.actual, platform) ||
      isSamePlatform(entry.platform.planned, platform),
  );

/**
 * True for an entry that was moved off `platform` to another one: it no longer leaves from
 * here, but a platform display keeps pointing to where it went (ADR-0006).
 */
export const changedAwayFrom = (entry: BoardEntry, platform: string): boolean =>
  entry.platform.changed &&
  entry.platform.actual !== undefined &&
  !isSamePlatform(entry.platform.actual, platform);
