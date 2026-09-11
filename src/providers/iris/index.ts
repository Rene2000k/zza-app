import { entriesForPlatform } from '@/domain/board';
import { sortByTime } from '@/domain/boardEntry';
import { berlinHoursCovering } from './berlinTime';
import { fetchChanges, fetchPlan, fetchStation } from './client';
import { mapBoardEntries, mapStationDetails } from './mapping';
import type { StationBoard } from '@/domain/board';
import type { StationDetails } from '@/domain/station';
import type { BoardRequest, DepartureProvider } from '@/providers/types';

const DEFAULT_HORIZON_MINUTES = 120;

/**
 * How far before `now` plan hours are fetched. A train planned before the current hour
 * can still be delayed into the display window, and `fchg` alone carries neither train
 * nor destination — without its plan hour, such a train would be missing (ADR-0008).
 */
const LOOK_BACK_MINUTES = 120;

/**
 * The IRIS adapter (ADR-0002): the only place that knows the concrete endpoints, XML
 * shape and field mapping (see `client.ts`/`mapping.ts`). Everything above this module
 * speaks the domain model.
 */
export const createIrisProvider = (): DepartureProvider => {
  // A station's name/DS100/platform list does not change during a running session, so
  // it is fetched once per query and reused rather than refetched on every poll.
  const stationCache = new Map<string, StationDetails>();
  // A plan hour is fetched once and kept while it is inside the window: IRIS serves
  // `plan` with max-age=86400, i.e. as fixed for the day, and everything that changes
  // later arrives through `fchg`, which is fetched on every poll (ADR-0008).
  const planCache = new Map<string, Document>();

  const resolveStationDetails = async (
    query: string,
    signal?: AbortSignal,
  ): Promise<StationDetails | undefined> => {
    const cached = stationCache.get(query);
    if (cached !== undefined) return cached;
    const doc = await fetchStation(query, signal);
    const details = mapStationDetails(doc)[0];
    if (details !== undefined) stationCache.set(query, details);
    return details;
  };

  const loadPlanHours = async (
    eva: string,
    now: Date,
    horizonMinutes: number,
    signal?: AbortSignal,
  ): Promise<Document[]> => {
    const start = new Date(now.getTime() - LOOK_BACK_MINUTES * 60_000);
    const hours = berlinHoursCovering(start, LOOK_BACK_MINUTES + horizonMinutes).map((hour) => ({
      hour,
      key: `${eva}/${hour.yymmdd}/${hour.hh}`,
    }));

    // Hours that slid out of the window are dropped, so the cache stays bounded over a day.
    const wanted = new Set(hours.map(({ key }) => key));
    for (const key of planCache.keys()) {
      if (key.startsWith(`${eva}/`) && !wanted.has(key)) planCache.delete(key);
    }

    return Promise.all(
      hours.map(async ({ hour, key }) => {
        const cached = planCache.get(key);
        if (cached !== undefined) return cached;
        const doc = await fetchPlan(eva, hour, signal);
        planCache.set(key, doc);
        return doc;
      }),
    );
  };

  return {
    id: 'iris',
    name: 'IRIS (Deutsche Bahn)',
    capabilities: {
      plannedPlatform: true,
      platformChanges: true,
      terminatingArrivals: true,
      viaStops: true,
      delayCauses: 'codes',
      cancellations: true,
      formations: false,
      stationPlatformList: true,
    },

    resolveStation: async (query: string, signal?: AbortSignal): Promise<StationDetails[]> => {
      const details = await resolveStationDetails(query, signal);
      return details === undefined ? [] : [details];
    },

    getBoard: async (request: BoardRequest, signal?: AbortSignal): Promise<StationBoard> => {
      const horizonMinutes = request.horizonMinutes ?? DEFAULT_HORIZON_MINUTES;
      // Resolved first — and cached after the first hit — so that a station IRIS does not
      // know under this EVA number costs no further requests.
      const station = await resolveStationDetails(request.station, signal);
      if (station === undefined) {
        throw new Error(`IRIS knows no station with EVA number ${request.station}`);
      }
      const [planDocs, fchgDoc] = await Promise.all([
        loadPlanHours(request.station, request.now, horizonMinutes, signal),
        fetchChanges(request.station, signal),
      ]);

      const all = sortByTime(mapBoardEntries(planDocs, fchgDoc));
      const entries = request.platform === undefined ? all : entriesForPlatform(all, request.platform);

      return {
        station,
        ...(request.platform === undefined ? {} : { platform: request.platform }),
        entries,
        fetchedAt: request.now,
      };
    },
  };
};
