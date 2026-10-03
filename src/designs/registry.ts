import { debugDesign } from './debug';
import { v3_5x2Design } from './v3-5x2';
import { v4_5x2Design } from './v4-5x2';
import type { ZzaDesign } from './types';

/**
 * Design lookup by id.
 *
 * The counterpart of the provider registry: the app shell picks a design from the
 * configuration and never imports one directly, so adding a design means adding an entry
 * here and touching nothing else.
 */
const designs: readonly ZzaDesign[] = [debugDesign, v3_5x2Design, v4_5x2Design];

export const designIds = (): string[] => designs.map((design) => design.id);

/** The design with this id, or undefined so the caller can report it as a configuration problem. */
export const findDesign = (id: string): ZzaDesign | undefined =>
  designs.find((design) => design.id === id);
