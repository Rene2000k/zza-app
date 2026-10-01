import { ProviderError } from '@/providers/errors';
import type { BerlinDateHour } from './berlinTime';

/**
 * The three IRIS endpoints this adapter needs (ADR-0002), called directly from the
 * browser — IRIS answers with `Access-Control-Allow-Origin: *`, so no proxy is needed.
 */
const BASE_URL = 'https://iris.noncd.db.de/iris-tts';

const parseXml = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  // DOMParser does not throw on malformed input; it returns a document containing a
  // <parsererror> element instead. IRIS's documented failure mode — an HTML "Request
  // Rejected" page on a blocked path (ADR-0002) — parses as exactly this kind of
  // non-XML document, so this is also how that surfaces as a fetch failure.
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new ProviderError('IRIS response was not valid XML');
  }
  return doc;
};

const getXml = async (path: string, signal?: AbortSignal): Promise<Document> => {
  const response = await fetch(`${BASE_URL}${path}`, signal === undefined ? {} : { signal });
  if (!response.ok) {
    throw new ProviderError(
      `IRIS request failed: ${response.status} ${response.statusText} (${path})`,
      { status: response.status },
    );
  }
  return parseXml(await response.text());
};

/** The planned timetable for one Europe/Berlin wall-clock hour at a station. */
export const fetchPlan = (
  eva: string,
  hour: BerlinDateHour,
  signal?: AbortSignal,
): Promise<Document> => getXml(`/timetable/plan/${eva}/${hour.yymmdd}/${hour.hh}`, signal);

/** All current deviations (times, platforms, cancellations, messages) for a station. */
export const fetchChanges = (eva: string, signal?: AbortSignal): Promise<Document> =>
  getXml(`/timetable/fchg/${eva}`, signal);

/** Station resolution by exact name or RL100/DS100 code (also accepts a bare EVA number). */
export const fetchStation = (query: string, signal?: AbortSignal): Promise<Document> =>
  getXml(`/timetable/station/${encodeURIComponent(query)}`, signal);
