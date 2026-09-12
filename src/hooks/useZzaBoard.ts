import { dataAgeSeconds, isStale, relevantEntries } from '@/domain/board';
import { sortByTime } from '@/domain/boardEntry';
import { displayableMessages } from '@/domain/message';
import { useBoard } from './useBoard';
import { useNow } from './useClock';
import type { BoardEntry } from '@/domain/boardEntry';
import type { BoardMessage } from '@/domain/message';
import type { StationRef } from '@/domain/station';
import type { DisplayConfig } from '@/app/config';

/**
 * Everything a design gets to render: the board already split into the slots a display
 * has, so a design holds no data logic of its own.
 *
 * This is the contract between the view-model layer and the designs.
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
  /** Messages of the current train that have a text — material for a running line. */
  readonly messages: readonly BoardMessage[];
  /** Age of the data in seconds, measured against the clock. */
  readonly dataAgeSeconds: number;
  /** True once the data is old enough that the display should say so. */
  readonly stale: boolean;
}

const LOADING: LoadingBoard = { state: 'loading' };
const UNAVAILABLE: UnavailableBoard = { state: 'unavailable' };

/**
 * Turns the polled board into the state a design renders.
 *
 * The slots are assigned by time alone: the next relevant entry is the main train, the rest
 * follow. A train that changed away from this platform therefore keeps its place in the
 * order instead of being pushed into the following rows — the real displays do move it, but
 * that rule needs its own work and is deliberately not guessed at here.
 */
export const useZzaBoard = (config: DisplayConfig): ZzaBoardViewModel => {
  const now = useNow();
  const { board, isLoading, staleAfterSeconds } = useBoard(config);

  if (isLoading) return LOADING;
  if (board === undefined) return UNAVAILABLE;

  const entries = sortByTime(
    relevantEntries(board.entries, now, { horizonMinutes: config.horizonMinutes }),
  );
  const [current, ...following] = entries;

  return {
    state: 'ready',
    station: board.station,
    platform: board.platform,
    current,
    following,
    messages: tickerMessages(current),
    dataAgeSeconds: dataAgeSeconds(board, now),
    stale: isStale(board, now, staleAfterSeconds),
  };
};

/**
 * The same text often arrives twice — once from the stop, once from the movement — and a
 * running line that says it twice looks broken, so identical texts are collapsed.
 */
const tickerMessages = (entry: BoardEntry | undefined): readonly BoardMessage[] => {
  if (entry === undefined) return [];
  const seen = new Set<string>();
  return displayableMessages(entry.messages).filter((message) => {
    const text = message.text ?? '';
    if (seen.has(text)) return false;
    seen.add(text);
    return true;
  });
};
