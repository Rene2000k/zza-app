import type { BoardMessage } from './message';
import type { RouteChange } from './routeChange';
import type { RouteStop } from './station';
import type { TrainFormation } from './formation';
import type { TrainRef } from './train';

/**
 * One line on the board.
 *
 * Per ADR-0003 a board mixes two kinds: trains departing from here, and trains
 * ending here. The kind is explicit rather than inferred from a missing destination,
 * so that absent data stays distinguishable from "this train ends here".
 */
export type BoardEntry = DepartureEntry | TerminatingArrivalEntry;

interface BoardEntryBase {
  /** Stable id from the source; used as the React key and for diffing across polls. */
  readonly id: string;
  readonly train: TrainRef;
  readonly platform: PlatformInfo;
  readonly time: EntryTime;
  readonly status: EntryStatus;
  readonly messages: readonly BoardMessage[];
  /** Coach sequence, when a source provides one. */
  readonly formation?: TrainFormation;
  /**
   * Ids of the entries this train runs coupled with from here — the other parts of one set of
   * coaches under several train numbers (ADR-0014). Each part stays an entry of its own with
   * its own delay and messages; the link always points both ways. Absent for a single train.
   */
  readonly coupledWith?: readonly string[];
}

export interface DepartureEntry extends BoardEntryBase {
  readonly kind: 'departure';
  /** Where the train is headed — the last stop of its remaining route. */
  readonly destination: RouteStop;
  /** Remaining stops after this station, in travel order, excluding the destination. */
  readonly via: readonly RouteStop[];
  /** Where the train came from, when known. Extra information, never the headline. */
  readonly origin?: RouteStop;
  /**
   * How today's route differs from the timetable (ADR-0012). Empty for the great majority of
   * entries. `destination` and `via` already describe the route actually taken; this says
   * what changed about it, which they cannot.
   */
  readonly routeChanges: readonly RouteChange[];
}

export interface TerminatingArrivalEntry extends BoardEntryBase {
  readonly kind: 'terminatingArrival';
  /** Where the train came from — the headline for a train that ends here. */
  readonly origin: RouteStop;
}

/**
 * The governing time of an entry: departure time for departures, arrival time for
 * trains that end here. Both are absolute instants; formatting happens in the design.
 */
export interface EntryTime {
  readonly planned: Date;
  /** Expected time including delay. Equals `planned` when running on time. */
  readonly expected: Date;
}

/**
 * Delay in whole minutes, truncated towards zero — the display convention: a train
 * 90 seconds late shows as 1 minute, and one 30 seconds early shows as 0 rather than
 * as "1 minute early".
 */
export const delayMinutes = (time: EntryTime): number => {
  const whole = Math.trunc((time.expected.getTime() - time.planned.getTime()) / 60_000);
  // Truncating a small negative difference yields -0, which would reach a display as
  // "-0" once formatted. Collapse it to a plain zero.
  return whole === 0 ? 0 : whole;
};

/** True when the entry runs later than planned by at least a full minute. */
export const isDelayed = (time: EntryTime): boolean => delayMinutes(time) > 0;

/**
 * The delay a display announces for an entry: none for a cancelled train, which a source may
 * still list with an expected time, but which has no departure that could be late. How the
 * minutes are rounded or shown stays the design's choice.
 */
export const announcedDelayMinutes = (entry: BoardEntry): number =>
  entry.status === 'cancelled' ? 0 : delayMinutes(entry.time);

export interface PlatformInfo {
  /** Platform from the timetable. Undefined when the source does not say. */
  readonly planned?: string;
  /** Platform actually in use; equals `planned` unless it changed. */
  readonly actual?: string;
  /** True when the train was moved to a different platform. */
  readonly changed: boolean;
}

export type EntryStatus =
  | 'onTime'
  | 'delayed'
  | 'cancelled'
  /** Runs, but not over its usual route. */
  | 'diverted'
  /** Replacement service for a cancelled train. */
  | 'replacement';

/** Where the train goes or came from, whichever this kind of entry leads with. */
export const headlineStation = (entry: BoardEntry): RouteStop =>
  entry.kind === 'departure' ? entry.destination : entry.origin;

/** Sort key for the board: the time this entry is governed by. */
export const entrySortKey = (entry: BoardEntry): number => entry.time.expected.getTime();

export const sortByTime = (entries: readonly BoardEntry[]): BoardEntry[] =>
  [...entries].sort((a, b) => entrySortKey(a) - entrySortKey(b));

/**
 * Timetable order: by planned time, so a delayed train keeps its place and its delay shows
 * beside it — the order of a station's departure board. The sort is stable, so entries with
 * the same planned time keep the order they came in.
 */
export const sortByPlannedTime = (entries: readonly BoardEntry[]): BoardEntry[] =>
  [...entries].sort((a, b) => a.time.planned.getTime() - b.time.planned.getTime());
