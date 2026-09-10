import { sortByTime } from '@/domain/boardEntry';
import { isSamePlatform } from '@/domain/station';
import type { StationBoard } from '@/domain/board';
import type { StationDetails } from '@/domain/station';
import type { BoardRequest, DepartureProvider } from '@/providers/types';
import { mockEntries, mockStations } from './fixtures';

/**
 * Fixture-backed provider.
 *
 * Exists so the display, the components and the designs can be built and reviewed
 * without a network and without waiting for a real cancellation to occur. It reports
 * capabilities honestly, so a design cannot accidentally rely on it for something the
 * real source lacks — except formations, which no source currently provides.
 */
export const createMockProvider = (): DepartureProvider => ({
  id: 'mock',
  name: 'Mock (Fixtures)',
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

  resolveStation: (query) => {
    const needle = query.trim().toLowerCase();
    const matches: StationDetails[] = mockStations.filter(
      (station) =>
        station.name.toLowerCase().includes(needle) ||
        station.evaNumber === needle ||
        station.ds100?.toLowerCase() === needle,
    );
    return Promise.resolve(matches);
  },

  getBoard: (request: BoardRequest) => {
    const station =
      mockStations.find((candidate) => candidate.evaNumber === request.station) ?? mockStations[0];
    if (station === undefined) {
      throw new Error('mock provider has no stations');
    }

    const all = mockEntries(request.now);
    const entries = request.platform
      ? all.filter((entry) => isSamePlatform(entry.platform.actual, request.platform))
      : all;

    const board: StationBoard = {
      station: {
        evaNumber: station.evaNumber,
        name: station.name,
        // Spreading a possibly-undefined value would violate exactOptionalPropertyTypes:
        // "absent" and "present but undefined" are different types here.
        ...(station.ds100 === undefined ? {} : { ds100: station.ds100 }),
      },
      ...(request.platform === undefined ? {} : { platform: request.platform }),
      entries: sortByTime(entries),
      fetchedAt: request.now,
    };
    return Promise.resolve(board);
  },
});
