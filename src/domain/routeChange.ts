import type { RouteStop } from './station';

/**
 * A departure whose route today differs from the timetable (ADR-0012).
 *
 * The source publishes a planned route and a changed one, and says nothing about the
 * difference between them — no marker, no wording. The provider compares the two and states
 * what kind of difference it found and which stops it concerns; the design turns that into a
 * sentence. Nothing here is text, so no wording is settled before a design asks for it.
 */
export type RouteChangeKind =
  /** Stops the train passes through today without calling. */
  | 'skippedStops'
  /** The train turns short: the stops it no longer reaches. */
  | 'endsEarly'
  /** Stops it calls at today on top of the timetable. */
  | 'additionalStops';

export interface RouteChange {
  readonly kind: RouteChangeKind;
  /**
   * The stops this change is about, in travel order.
   *
   * For `endsEarly` these are the stops no longer reached, so the last of them is the
   * terminus the timetable promised — while the entry's `destination` already names where
   * the train does end. A design can word either half without asking the provider.
   */
  readonly stops: readonly RouteStop[];
}

/**
 * A diversion is not a kind of its own: it reaches a display as skipped stops next to
 * additional ones, which is what a platform display says about it anyway.
 */
export const routeChangesOfKind = (
  changes: readonly RouteChange[],
  kind: RouteChangeKind,
): RouteChange | undefined => changes.find((change) => change.kind === kind);
