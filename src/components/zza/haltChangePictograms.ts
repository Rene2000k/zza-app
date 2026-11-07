import type { PictogramId } from './Pictogram';
import type { RouteChange } from '@/domain/routeChange';

/**
 * The halt boxes a train's route changes give, in the order they stand (ADR-0013).
 *
 * Additional stops give H+; skipped stops and a train ending early both give H−, since
 * either way stops of the timetable are not served. A train with both kinds of change — a
 * diversion — shows both, H+ first. Callers pass the route changes the train notices
 * announce, so a train that makes no journey carries none.
 */
export const haltChangePictograms = (
  routeChanges: readonly RouteChange[],
): readonly PictogramId[] => {
  const kinds = new Set(routeChanges.map((change) => change.kind));
  const pictograms: PictogramId[] = [];
  if (kinds.has('additionalStops')) pictograms.push('haltPlus');
  if (kinds.has('skippedStops') || kinds.has('endsEarly')) pictograms.push('haltMinus');
  return pictograms;
};
