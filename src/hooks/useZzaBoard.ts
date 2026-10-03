import { changedAwayFrom, dataAgeSeconds, isStale, relevantEntries } from '@/domain/board';
import { sortByTime } from '@/domain/boardEntry';
import { collapseCoupledParts, coupledPartners } from '@/domain/coupling';
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
  /**
   * The part the main train runs coupled with and that goes somewhere else — two train numbers
   * leaving as one, to be split ahead (ADR-0014). Undefined for a train that runs alone. It is
   * not repeated among the following trains; a part that goes the same way is not shown at all.
   */
  readonly secondPart: BoardEntry | undefined;
  /**
   * Trains after the current one: first those that do not leave from here — cancelled, or
   * changed away from this platform — then the rest, each group in time order. A design shows
   * as many as it has rows for.
   */
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
 * The slots are assigned by time: the next relevant entry is the main train, the rest follow —
 * except for a coupled main train, whose second part stands beside it, and for trains that do
 * not leave from here: those that are cancelled, and those that changed away from this
 * display's platform (ADR-0006). They never become the main train; they move to the top of
 * the following trains, where a design marks them, and the next train that really leaves here
 * moves up. A station-wide display has no platform to leave, so there only cancelled trains
 * move.
 */
export const useZzaBoard = (config: DisplayConfig): ZzaBoardViewModel => {
  const now = useNow();
  const { board, isLoading, staleAfterSeconds } = useBoard(config);

  if (isLoading) return LOADING;
  if (board === undefined) return UNAVAILABLE;

  const entries = collapseCoupledParts(
    sortByTime(relevantEntries(board.entries, now, { horizonMinutes: config.horizonMinutes })),
  );
  const { platform } = board;
  const leavesNotHere = (entry: BoardEntry) =>
    entry.status === 'cancelled' || (platform !== undefined && changedAwayFrom(entry, platform));
  const [current, ...rest] = entries.filter((entry) => !leavesNotHere(entry));
  // A cancelled part is no second part: the other one runs alone and it is listed below.
  const secondPart = current === undefined ? undefined : coupledPartners(current, rest)[0];

  return {
    state: 'ready',
    station: board.station,
    platform,
    current,
    secondPart,
    following: [...entries.filter(leavesNotHere), ...rest.filter((entry) => entry !== secondPart)],
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
