import type { BoardEntry } from '@/domain/boardEntry';
import type { StationRef } from '@/domain/station';

/**
 * Everything a design gets to render: the board already split into the slots a display
 * has, so a design holds no data logic of its own.
 *
 * This is the contract between the view-model layer and the designs. `useZzaBoard` derives
 * it from the board, the clock and the polling state.
 */
export type ZzaBoardViewModel = LoadingBoard | UnavailableBoard | ReadyBoard;

/** The first fetch is still running; there is nothing to show yet. */
export interface LoadingBoard {
  readonly state: 'loading';
}

/** No board has arrived at all — the source failed before its first success. */
export interface UnavailableBoard {
  readonly state: 'unavailable';
}

export interface ReadyBoard {
  readonly state: 'ready';
  readonly station: StationRef;
  /** Platform the display stands at; undefined for a station-wide display. */
  readonly platform: string | undefined;
  /** The main train, or undefined when nothing is due and the display rests. */
  readonly current: BoardEntry | undefined;
  /** Trains after the current one, in time order. A design shows as many as it has rows for. */
  readonly following: readonly BoardEntry[];
  /** Age of the data in seconds, measured against the clock. */
  readonly dataAgeSeconds: number;
  /** True once the data is old enough that the display should say so. */
  readonly stale: boolean;
}
