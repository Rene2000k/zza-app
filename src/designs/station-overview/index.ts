import { StationOverview } from './StationOverview';
import type { ZzaDesign } from '../types';

/**
 * The original is a single LCD panel in landscape, close to 16 : 9 in the photographs, so the
 * canvas is a full-HD screen — the derivation is in layout.md.
 */
export const stationOverviewDesign: ZzaDesign = {
  id: 'station-overview',
  name: 'Bahnhofsübersicht',
  canvas: { width: 1920, height: 1080 },
  Component: StationOverview,
};
