import type { RouteStop } from './station';

/** What to render for a via line, and how much was left out. */
export interface ViaSelection {
  readonly stops: readonly RouteStop[];
  readonly omittedCount: number;
}

/**
 * Picks the via stops a display actually has room for.
 *
 * ADR-0005: a fixed, deterministic rule rather than a significance heuristic — IRIS gives
 * no data to rank stops by importance. Keeps the first `maxStops - 1` stops plus the final
 * one before the destination, so the approach point is never the one silently dropped.
 * `maxStops` is a parameter, not a constant: a design with more room asks for more, with
 * no change to how the data was mapped in the first place.
 */
export const selectViaStops = (via: readonly RouteStop[], maxStops: number): ViaSelection => {
  if (via.length <= maxStops) {
    return { stops: via, omittedCount: 0 };
  }
  if (maxStops < 1) {
    return { stops: [], omittedCount: via.length };
  }

  const kept = via.slice(0, maxStops - 1);
  const last = via.at(-1);
  if (last === undefined) {
    // Unreachable: via.length > maxStops >= 1 guarantees at least one element.
    throw new Error('selectViaStops: via unexpectedly empty');
  }
  return { stops: [...kept, last], omittedCount: via.length - maxStops };
};
