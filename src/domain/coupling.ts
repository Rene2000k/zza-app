import type { BoardEntry } from './boardEntry';
import type { RouteStop } from './station';

/**
 * Coupled trains: one set of coaches that leaves under two or more train numbers, usually to
 * be split somewhere ahead (ADR-0014). Every part is an entry of its own, linked to the others
 * by `coupledWith`; these rules decide what a display makes of the link.
 */

/** The parts `entry` runs coupled with, as far as they are among `entries`, in their order. */
export const coupledPartners = (entry: BoardEntry, entries: readonly BoardEntry[]): BoardEntry[] =>
  entries.filter((other) => entry.coupledWith?.includes(other.id) ?? false);

/**
 * Two coupled parts go separate ways after this station: both depart, for different
 * destinations. Parts that end here together, or run to the same destination, do not — they
 * were joined somewhere behind and stay one train as far as this platform is concerned.
 */
export const separatesAhead = (a: BoardEntry, b: BoardEntry): boolean =>
  a.kind === 'departure' && b.kind === 'departure' && a.destination.name !== b.destination.name;

/**
 * Where two parts that separate ahead are split: the last stop on the first part's way that
 * the second part calls at as well. A part that ends where the other goes on names its own
 * destination. Undefined when the parts do not separate, or have no stop ahead in common.
 */
export const splitStop = (a: BoardEntry, b: BoardEntry): RouteStop | undefined => {
  if (a.kind !== 'departure' || b.kind !== 'departure' || !separatesAhead(a, b)) return undefined;
  const calledAtByB = new Set([...b.via, b.destination].map((stop) => stop.name));
  return [...a.via, a.destination].filter((stop) => calledAtByB.has(stop.name)).at(-1);
};

/**
 * The entries a display lists, with each part that goes the same way as an earlier-listed
 * part left out: it would only repeat the destination under a second number. Parts that
 * separate ahead all stay, since each of them goes somewhere else.
 */
export const collapseCoupledParts = (entries: readonly BoardEntry[]): BoardEntry[] => {
  const ridingAlong = new Set<string>();
  const listed: BoardEntry[] = [];
  for (const entry of entries) {
    if (ridingAlong.has(entry.id)) continue;
    listed.push(entry);
    for (const partner of coupledPartners(entry, entries)) {
      if (!separatesAhead(entry, partner)) ridingAlong.add(partner.id);
    }
  }
  return listed;
};
