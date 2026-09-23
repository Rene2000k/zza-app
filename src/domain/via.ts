import type { RouteStop } from './station';

/** What to render for a via line, and how much was left out. */
export interface ViaSelection {
  readonly stops: readonly RouteStop[];
  readonly omittedCount: number;
}

/**
 * Picks the via stops a display actually has room for: the next ones in travel order.
 *
 * ADR-0005: a fixed, deterministic count rather than a significance heuristic — IRIS gives no
 * data to rank stops by importance — and the stops right after this station rather than a jump
 * to the approach point, because that is what the real displays show. `maxStops` is a parameter,
 * not a constant: a design with more room asks for more, with no change to how the data was
 * mapped in the first place.
 */
export const selectViaStops = (via: readonly RouteStop[], maxStops: number): ViaSelection => {
  const stops = via.slice(0, Math.max(0, maxStops));
  return { stops, omittedCount: via.length - stops.length };
};
