import { V4_5x2 } from './V4_5x2';
import type { ZzaDesign } from '../types';

/**
 * The canvas keeps the original's measured proportion: five modules of 240 × 160 px with 2 px
 * seams between them and a 31 px gap between the two module rows — the derivation is in
 * layout.md.
 */
export const v4_5x2Design: ZzaDesign = {
  id: 'v4-5x2',
  name: 'V4 5X2',
  canvas: { width: 1208, height: 351 },
  Component: V4_5x2,
};
