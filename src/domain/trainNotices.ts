import { changedAwayFrom } from './board';
import { splitStop } from './coupling';
import { uniqueMessages } from './message';
import type { BoardEntry } from './boardEntry';
import type { BoardMessage } from './message';
import type { RouteChange } from './routeChange';
import type { RouteStop } from './station';

/**
 * What a display has to say about one train, as facts rather than text (ADR-0009). Every design
 * reads the same record, so two displays can disagree about wording and order but never about
 * whether a train is cancelled, replaced, split or moved. The record carries no German and no
 * order — both are a design's choice between true renderings.
 */
export interface TrainNotices {
  /** The train is a replacement service. */
  readonly replacement: boolean;
  /**
   * Present when the train is cancelled. Carries the source's own cancellation message when
   * the source delivered one; without it, the design words the cancellation itself, so that a
   * cancellation is never silent.
   */
  readonly cancellation?: { readonly message?: BoardMessage };
  /**
   * Where the train and its coupled part split (ADR-0014). Absent without a coupled part,
   * without a stop ahead in common, or when either part does not run — a split that will not
   * happen is not announced.
   */
  readonly splitStop?: RouteStop;
  /**
   * The platform the train leaves from today, when it changed platform and that is not the
   * display's own (ADR-0006) — on a station-wide display, whenever it changed platform.
   */
  readonly movedTo?: string;
  /**
   * How today's route differs from the timetable. Always empty for a cancelled train: it makes
   * no journey whose stops could differ, whatever the source says.
   */
  readonly routeChanges: readonly RouteChange[];
}

/** Where the train is shown. */
export interface NoticeContext {
  /** The platform the display stands at; absent for a station-wide display. */
  readonly platform?: string | undefined;
  /** The part the train runs coupled with on this display, if any. */
  readonly coupledPart?: BoardEntry | undefined;
}

const cancellationOf = (entry: BoardEntry): NonNullable<TrainNotices['cancellation']> => {
  const message = uniqueMessages(entry.messages).find(({ kind }) => kind === 'cancellation');
  return message === undefined ? {} : { message };
};

const splitStopOf = (entry: BoardEntry, partner: BoardEntry | undefined): RouteStop | undefined =>
  partner === undefined || entry.status === 'cancelled' || partner.status === 'cancelled'
    ? undefined
    : splitStop(entry, partner);

/**
 * The notices for `entry` on one display. Carries no switch for a display generation: what a
 * design leaves out is its own selection, so no design can change what another one is told.
 */
export const trainNotices = (entry: BoardEntry, context: NoticeContext): TrainNotices => {
  const cancelled = entry.status === 'cancelled';
  const split = splitStopOf(entry, context.coupledPart);
  const movedTo = changedAwayFrom(entry, context.platform) ? entry.platform.actual : undefined;
  return {
    replacement: entry.status === 'replacement',
    ...(cancelled ? { cancellation: cancellationOf(entry) } : {}),
    ...(split === undefined ? {} : { splitStop: split }),
    ...(movedTo === undefined ? {} : { movedTo }),
    routeChanges: entry.kind === 'departure' && !cancelled ? entry.routeChanges : [],
  };
};
