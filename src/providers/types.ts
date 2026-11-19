import type { StationBoard } from '@/domain/board';
import type { StationDetails } from '@/domain/station';
import type { TrainFormation } from '@/domain/formation';

/**
 * The only place that knows a concrete data source. Everything above the provider
 * layer speaks the domain model, so swapping the source is a contained change
 * (see ADR-0002, where the chosen source may need replacing at short notice).
 */
export interface DepartureProvider {
  readonly id: string;
  /** Human-readable name for diagnostics and the configuration UI. */
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  /** Resolve a free-text query — station name or operational code — to candidates. */
  resolveStation(query: string, signal?: AbortSignal): Promise<StationDetails[]>;

  /** The board for one station, optionally filtered to a single platform. */
  getBoard(request: BoardRequest, signal?: AbortSignal): Promise<StationBoard>;
}

export interface BoardRequest {
  /** EVA number of the station. */
  readonly station: string;
  /** Platform label to filter to; omitted means the whole station. */
  readonly platform?: string;
  /** The instant the board should describe — comes from the clock, never from Date. */
  readonly now: Date;
  /** How far ahead to look, in minutes. */
  readonly horizonMinutes?: number;
}

/**
 * Where Wagenreihungen come from — a port of its own, configured independently of the
 * departure provider (ADR-0015). It knows nothing about departures: it is asked about one
 * train at a time and answers with its Wagenreihung, or `null` when it has none, which is
 * the normal case rather than an error.
 */
export interface FormationProvider {
  readonly id: string;
  /** Human-readable name for diagnostics and the configuration UI. */
  readonly name: string;

  getFormation(request: FormationRequest, signal?: AbortSignal): Promise<TrainFormation | null>;
}

/**
 * One departure, described well enough for a source to find its Wagenreihung. A train number
 * can run in several variants by period and starting station, so the request carries the
 * route as well as the number and the date.
 *
 * Stations are given by name: departure sources commonly report routes without EVA numbers,
 * so a name is what every stop can be matched by.
 */
export interface FormationRequest {
  readonly train: { readonly category: string; readonly number: string };
  /** Planned departure from the current station. */
  readonly plannedDeparture: Date;
  /** Name of the station the train departs from. */
  readonly station: string;
  /** Name of the station the train started from, when known. */
  readonly origin?: string;
  /** Names of all remaining stops after the current station, in travel order, destination last. */
  readonly route: readonly string[];
}

/**
 * What a source actually delivers.
 *
 * Designs need this to tell "no data available from this source" from "no data right
 * now", so they can show a defined idle state instead of an empty field.
 */
export interface ProviderCapabilities {
  /** Reports the platform from the timetable. */
  readonly plannedPlatform: boolean;
  /** Reports platform changes. */
  readonly platformChanges: boolean;
  /** Reports trains that end at the station (ADR-0003). */
  readonly terminatingArrivals: boolean;
  /** Reports intermediate stops of the onward route. */
  readonly viaStops: boolean;
  /** Reports delay causes — as codes, as text, or not at all. */
  readonly delayCauses: 'none' | 'codes' | 'text';
  readonly cancellations: boolean;
  /** Reports the platforms a station has, for the configuration UI. */
  readonly stationPlatformList: boolean;
}
