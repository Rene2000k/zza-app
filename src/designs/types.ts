import type { ComponentType } from 'react';
import type { ZzaBoardViewModel } from '@/hooks/useZzaBoard';

/**
 * A display design: which blocks appear, where, at what size and in what look.
 *
 * A design renders at its display's native resolution and may think in fixed pixels; the
 * app scales the result to the screen. It places the generic blocks from
 * `components/zza` and fills their tokens, receives a prepared view model, holds no data
 * logic of its own and never sees a provider. What is shown is the blocks' business, how
 * it looks is the design's.
 */
export interface ZzaDesign {
  /** Stable id used in the configuration, e.g. "v3-5x2". */
  readonly id: string;
  /** Name for the configuration UI, e.g. "V3 5X2". */
  readonly name: string;
  /** Native resolution of the display, in pixels. */
  readonly canvas: { readonly width: number; readonly height: number };
  readonly Component: ComponentType<{ readonly board: ZzaBoardViewModel }>;
}
