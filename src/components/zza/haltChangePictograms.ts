import type { PictogramId } from './Pictogram';
import type { BoardEntry } from '@/domain/boardEntry';

/**
 * The halt boxes an entry carries, in the order they stand (ADR-0013).
 *
 * Additional stops give H+; skipped stops and a train ending early both give H−, since
 * either way stops of the timetable are not served. A train with both kinds of change — a
 * diversion — shows both, H+ first. Only departures have a route that can change.
 */
export const haltChangePictograms = (entry: BoardEntry): readonly PictogramId[] => {
  if (entry.kind !== 'departure') return [];
  const kinds = new Set(entry.routeChanges.map((change) => change.kind));
  const pictograms: PictogramId[] = [];
  if (kinds.has('additionalStops')) pictograms.push('haltPlus');
  if (kinds.has('skippedStops') || kinds.has('endsEarly')) pictograms.push('haltMinus');
  return pictograms;
};
