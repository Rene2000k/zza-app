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
