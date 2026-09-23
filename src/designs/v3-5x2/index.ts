import { V3_5x2 } from './V3_5x2';
import type { ZzaDesign } from '../types';

/**
 * The canvas keeps the original's measured proportion rather than its dot count: five modules
 * of 252 × 192 px with 3 px seams between them and a 33 px gap between the two module rows —
 * the derivation is in layout.md.
 */
export const v3_5x2Design: ZzaDesign = {
  id: 'v3-5x2',
  name: 'V3 5X2',
  canvas: { width: 1272, height: 417 },
  Component: V3_5x2,
};
