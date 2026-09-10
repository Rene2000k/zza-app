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

  /** Coach sequence for one train, where the source has it. */
  getFormation?(request: FormationRequest, signal?: AbortSignal): Promise<TrainFormation | null>;
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

export interface FormationRequest {
  readonly train: { readonly category: string; readonly number: string };
  readonly station: string;
  readonly plannedDeparture: Date;
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
  readonly formations: boolean;
  /** Reports the platforms a station has, for the configuration UI. */
  readonly stationPlatformList: boolean;
}
