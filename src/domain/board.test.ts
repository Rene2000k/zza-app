import { describe, expect, it } from 'vitest';
import { dataAgeSeconds, entriesForPlatform, isStale, relevantEntries } from './board';
import { headlineStation, sortByTime } from './boardEntry';
import type { StationBoard } from './board';
import type { BoardEntry } from './boardEntry';

/**
 * Domain tests build their own entries on purpose: the domain layer must be testable
 * without the provider layer, or the dependency direction has been broken somewhere.
 */
const reference = new Date('2026-09-09T08:00:00+02:00');
const minutes = (n: number) => n * 60_000;

const time = (offsetMinutes: number, delay = 0) => {
  const planned = new Date(reference.getTime() + minutes(offsetMinutes));
  return { planned, expected: new Date(planned.getTime() + minutes(delay)) };
};

const departure = (id: string, offsetMinutes: number, delay = 0): BoardEntry => ({
  kind: 'departure',
  id,
  train: { category: 'ICE', number: '571' },
  platform: { planned: '9', actual: '9', changed: false },
  time: time(offsetMinutes, delay),
  status: delay === 0 ? 'onTime' : 'delayed',
  messages: [],
  routeChanges: [],
  destination: { evaNumber: '8000096', name: 'Stuttgart Hbf' },
  via: [],
});

const terminating = (id: string, offsetMinutes: number): BoardEntry => ({
  kind: 'terminatingArrival',
  id,
  train: { category: 'RB', number: '15645' },
  platform: { planned: '9', actual: '9', changed: false },
  time: time(offsetMinutes),
  status: 'onTime',
  messages: [],
  origin: { evaNumber: '8000770', name: 'Dieburg' },
});

describe('board selection', () => {
  it('orders entries by the time that governs them', () => {
    const sorted = sortByTime([departure('late', 20), terminating('mid', 10), departure('soon', 2)]);
    expect(sorted.map((entry) => entry.id)).toEqual(['soon', 'mid', 'late']);
  });

  it('keeps a just-departed train and drops one long gone', () => {
    const entries = [departure('a', 4)];
    const justAfter = new Date(reference.getTime() + minutes(4.5));
    expect(relevantEntries(entries, justAfter)).toHaveLength(1);

    const muchLater = new Date(reference.getTime() + minutes(30));
    expect(relevantEntries(entries, muchLater)).toHaveLength(0);
  });

  it('applies the horizon to the expected time, not the planned one', () => {
    // Both are planned within 10 minutes, but the second is 12 minutes late and is
    // therefore expected at +21. A board shows what is actually coming, so it drops out.
    const entries = [departure('punctual', 4), departure('delayed', 9, 12)];
    const shortHorizon = relevantEntries(entries, reference, { horizonMinutes: 10 });
    expect(shortHorizon.map((entry) => entry.id)).toEqual(['punctual']);
  });

  it('leads a terminating train with its origin, a departure with its destination', () => {
    expect(headlineStation(terminating('t', 5)).name).toBe('Dieburg');
    expect(headlineStation(departure('d', 5)).name).toBe('Stuttgart Hbf');
  });

  it('measures data age against the given instant, not the system clock', () => {
    const board: StationBoard = {
      station: { evaNumber: '8000105', name: 'Frankfurt(Main)Hbf' },
      entries: [],
      fetchedAt: reference,
    };
    expect(dataAgeSeconds(board, new Date(reference.getTime() + 45_000))).toBe(45);
    // A board from the future must not report a negative age.
    expect(dataAgeSeconds(board, new Date(reference.getTime() - 5_000))).toBe(0);
  });
});

describe('entriesForPlatform (ADR-0006)', () => {
  const onPlatform = (planned: string, actual: string, changed: boolean): BoardEntry => ({
    ...departure('e', 4),
    platform: { planned, actual, changed },
  });

  it('keeps an entry that is currently at the requested platform', () => {
    const entry = onPlatform('9', '9', false);
    expect(entriesForPlatform([entry], '9')).toEqual([entry]);
  });

  it('keeps an entry that was planned here and later moved elsewhere', () => {
    const entry = onPlatform('9', '4', true);
    expect(entriesForPlatform([entry], '9')).toEqual([entry]);
  });

  it('keeps an entry that moved to the requested platform from elsewhere', () => {
    const entry = onPlatform('7', '9', true);
    expect(entriesForPlatform([entry], '9')).toEqual([entry]);
  });

  it('excludes an entry with no planned or actual claim on the platform', () => {
    const entry = onPlatform('7', '4', true);
    expect(entriesForPlatform([entry], '9')).toEqual([]);
  });
});

describe('isStale', () => {
  const board: StationBoard = {
    station: { evaNumber: '8000105', name: 'Frankfurt(Main)Hbf' },
    entries: [],
    fetchedAt: reference,
  };

  it('is not stale up to and including the threshold', () => {
    expect(isStale(board, new Date(reference.getTime() + 90_000), 90)).toBe(false);
  });

  it('is stale once the data is older than the threshold', () => {
    expect(isStale(board, new Date(reference.getTime() + 91_000), 90)).toBe(true);
  });
});
