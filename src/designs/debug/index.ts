import { DebugDesign } from './DebugDesign';
import type { ZzaDesign } from '../types';

/**
 * The canvas size is arbitrary for this design — 16:9 at a resolution where its layout is
 * legible. A design reproducing real hardware takes its canvas from that hardware instead.
 */
export const debugDesign: ZzaDesign = {
  id: 'debug',
  name: 'Debug',
  canvas: { width: 960, height: 540 },
  Component: DebugDesign,
};
