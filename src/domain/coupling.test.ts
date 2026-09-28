import { describe, expect, it } from 'vitest';
import { collapseCoupledParts, coupledPartners, separatesAhead, splitStop } from './coupling';
import type { DepartureEntry, TerminatingArrivalEntry } from './boardEntry';

const time = {
  planned: new Date('2026-09-25T10:20:00Z'),
  expected: new Date('2026-09-25T10:20:00Z'),
};

const departure = (
  id: string,
  route: readonly string[],
  coupledWith?: readonly string[],
): DepartureEntry => ({
  kind: 'departure',
  id,
  train: { category: 'HLB', number: id },
  platform: { planned: '15', actual: '15', changed: false },
  time,
  status: 'onTime',
  messages: [],
  routeChanges: [],
  destination: { name: route.at(-1) ?? '' },
  via: route.slice(0, -1).map((name) => ({ name })),
  ...(coupledWith === undefined ? {} : { coupledWith }),
});

const terminating = (
  id: string,
  origin: string,
  coupledWith: readonly string[],
): TerminatingArrivalEntry => ({
  kind: 'terminatingArrival',
  id,
  train: { category: 'RE', number: id },
  platform: { planned: '7', actual: '7', changed: false },
  time,
  status: 'onTime',
  messages: [],
  origin: { name: origin },
  coupledWith,
});

// HLB 15012 and 15112 from Frankfurt(Main)Hbf, 2026-09-25: together to Gießen, then apart.
const toKassel = departure(
  '15012',
  ['Friedberg(Hess)', 'Gießen', 'Marburg(Lahn)', 'Kassel Hbf'],
  ['15112'],
);
const toSiegen = departure(
  '15112',
  ['Friedberg(Hess)', 'Gießen', 'Wetzlar', 'Siegen Hbf'],
  ['15012'],
);

// ICE 857 and 847 from Hannover Hbf: joined behind, together all the way to Berlin.
const ice857 = departure('857', ['Wolfsburg Hbf', 'Berlin Hbf', 'Berlin Südkreuz'], ['847']);
const ice847 = departure('847', ['Wolfsburg Hbf', 'Berlin Hbf', 'Berlin Südkreuz'], ['857']);

const single = departure('4168', ['Mannheim Hbf']);

describe('coupled train parts (ADR-0014)', () => {
  it('finds the partners of an entry among the listed ones', () => {
    expect(coupledPartners(toKassel, [single, toKassel, toSiegen])).toEqual([toSiegen]);
    expect(coupledPartners(single, [single, toKassel, toSiegen])).toEqual([]);
  });

  it('separates parts that depart for different destinations', () => {
    expect(separatesAhead(toKassel, toSiegen)).toBe(true);
    expect(separatesAhead(ice857, ice847)).toBe(false);
  });

  it('does not separate parts that end here together', () => {
    const fromFlensburg = terminating('11169', 'Flensburg', ['11269']);
    const fromKiel = terminating('11269', 'Kiel Hbf', ['11169']);
    expect(separatesAhead(fromFlensburg, fromKiel)).toBe(false);
    expect(splitStop(fromFlensburg, fromKiel)).toBeUndefined();
  });

  it('splits at the last stop both parts call at', () => {
    expect(splitStop(toKassel, toSiegen)).toEqual({ name: 'Gießen' });
    expect(splitStop(toSiegen, toKassel)).toEqual({ name: 'Gießen' });
  });

  it('names the destination of a part that ends where the other goes on', () => {
    const toNeumuenster = departure('a', ['Elmshorn', 'Neumünster'], ['b']);
    const toKiel = departure('b', ['Elmshorn', 'Neumünster', 'Kiel Hbf'], ['a']);
    expect(splitStop(toKiel, toNeumuenster)).toEqual({ name: 'Neumünster' });
  });

  it('names no split for parts that share no stop ahead, or do not separate', () => {
    const north = departure('a', ['Hamburg Hbf'], ['b']);
    const south = departure('b', ['München Hbf'], ['a']);
    expect(splitStop(north, south)).toBeUndefined();
    expect(splitStop(ice857, ice847)).toBeUndefined();
  });

  it('leaves out a part that goes the same way as one listed before it', () => {
    expect(collapseCoupledParts([ice857, ice847, single])).toEqual([ice857, single]);
    // Whichever part comes first stands for both.
    expect(collapseCoupledParts([ice847, ice857, single])).toEqual([ice847, single]);
  });

  it('keeps every part that goes somewhere else', () => {
    expect(collapseCoupledParts([toKassel, toSiegen, single])).toEqual([
      toKassel,
      toSiegen,
      single,
    ]);
  });
});
