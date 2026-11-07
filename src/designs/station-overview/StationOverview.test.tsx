import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StationOverview } from './StationOverview';
import type { DepartureEntry, EntryTime, TerminatingArrivalEntry } from '@/domain/boardEntry';
import type { ReadyBoard, ZzaBoardViewModel } from '@/hooks/useZzaBoard';

// 08:00 UTC is 10:00 at the station.
const NOW = new Date(Date.UTC(2026, 8, 11, 8, 0));

const at = (minutes: number, delay = 0): EntryTime => {
  const planned = new Date(NOW.getTime() + minutes * 60_000);
  return { planned, expected: new Date(planned.getTime() + delay * 60_000) };
};

const departure = (overrides: Partial<DepartureEntry> & { id: string }): DepartureEntry => ({
  kind: 'departure',
  train: { category: 'ICE', number: '571' },
  platform: { planned: '9', actual: '9', changed: false },
  time: at(20),
  status: 'onTime',
  messages: [],
  routeChanges: [],
  destination: { name: 'Stuttgart Hbf' },
  via: [],
  ...overrides,
});

const terminating: TerminatingArrivalEntry = {
  kind: 'terminatingArrival',
  id: 'rb-15645',
  train: { category: 'RB', number: '15645', line: 'RB61' },
  platform: { planned: '3', actual: '3', changed: false },
  time: at(2),
  status: 'onTime',
  messages: [],
  origin: { name: 'Dieburg' },
};

const ready = (
  entries: ReadyBoard['entries'],
  overrides: Partial<ReadyBoard> = {},
): ReadyBoard => ({
  state: 'ready',
  station: { evaNumber: '8000105', name: 'Frankfurt(Main)Hbf' },
  platform: undefined,
  current: entries[0],
  secondPart: undefined,
  following: entries.slice(1),
  entries,
  now: NOW,
  messages: [],
  dataAgeSeconds: 4,
  stale: false,
  ...overrides,
});

const show = (board: ZzaBoardViewModel) => render(<StationOverview board={board} />).container;

const dots = (container: HTMLElement) => [...container.querySelectorAll('[data-filled]')];

const route = (...names: string[]) => names.map((name) => ({ name }));

describe('Station overview design', () => {
  it('shows the clock and names the board and its columns', () => {
    show(ready([]));
    expect(screen.getByText('10:00')).toBeDefined();
    expect(screen.getByRole('img', { name: 'Uhrzeit' })).toBeDefined();
    expect(screen.getByText('Abfahrt')).toBeDefined();
    for (const label of ['Geplant', 'Erwartet', 'Zug', 'Über', 'Ziel', 'Gleis']) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('lists every train with time, train, via stops, destination and platform', () => {
    const via = route('Darmstadt Hbf', 'Mannheim Hbf', 'Heidelberg Hbf', 'Vaihingen', 'Ulm');
    show(
      ready([
        departure({ id: 'ice', via }),
        departure({
          id: 're',
          train: { category: 'RE', number: '4168', line: 'RE60' },
          time: at(25),
          platform: { planned: '12', actual: '12', changed: false },
          destination: { name: 'Gießen' },
        }),
      ]),
    );
    expect(screen.getByText('10:20')).toBeDefined();
    expect(screen.getByText('ICE 571')).toBeDefined();
    expect(
      screen.getByText('Darmstadt Hbf – Mannheim Hbf – Heidelberg Hbf – Vaihingen'),
    ).toBeDefined();
    expect(screen.getByText('Stuttgart Hbf')).toBeDefined();
    expect(screen.getByText('9')).toBeDefined();
    expect(screen.getByText('RE60')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
  });

  it('shows no more lines than the board has', () => {
    const entries = Array.from({ length: 15 }, (_, index) =>
      departure({ id: `t${index}`, time: at(10 + index) }),
    );
    show(ready(entries));
    expect(screen.getAllByText('ICE 571')).toHaveLength(12);
  });

  it('marks a train hollow from five minutes before it leaves and filled from three', () => {
    const container = show(
      ready([
        departure({ id: 'gone', time: at(-1) }),
        departure({ id: 'three', time: at(3) }),
        departure({ id: 'four', time: at(4) }),
        departure({ id: 'five', time: at(5) }),
        departure({ id: 'six', time: at(6) }),
      ]),
    );
    expect(dots(container).map((dot) => dot.getAttribute('data-filled'))).toEqual([
      'true',
      'true',
      'false',
      'false',
    ]);
  });

  it('blinks the dots, all of them together', () => {
    vi.useFakeTimers();
    try {
      const container = show(
        ready([departure({ id: 'a', time: at(2) }), departure({ id: 'b', time: at(4) })]),
      );
      const lit = () => dots(container).map((dot) => dot.getAttribute('data-lit'));
      expect(lit()).toEqual(['true', 'true']);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(lit()).toEqual(['false', 'false']);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(lit()).toEqual(['true', 'true']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks each train with the pictogram and the box of its kind', () => {
    show(
      ready([
        departure({ id: 'ice' }),
        departure({ id: 're', train: { category: 'RE', number: '4168', line: 'RE60' } }),
        departure({ id: 's', train: { category: 'S', number: '35862', line: 'S8' } }),
      ]),
    );
    expect(screen.getAllByRole('img', { name: 'Zug' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'S-Bahn' })).toHaveLength(1);
    expect(screen.getByText('ICE 571').getAttribute('data-service')).toBe('longDistance');
    expect(screen.getByText('RE60').getAttribute('data-service')).toBe('regional');
    expect(screen.getByText('S8').getAttribute('data-service')).toBe('suburban');
  });

  it('counts down to the expected departure, not the planned one', () => {
    const container = show(ready([departure({ id: 'late', time: at(2, 10) })]));
    expect(dots(container)).toHaveLength(0);
  });

  it('does not mark a cancelled train', () => {
    const container = show(ready([departure({ id: 'x', time: at(2), status: 'cancelled' })]));
    expect(dots(container)).toHaveLength(0);
  });

  it('prints the expected time inverted beside the planned one from a full minute late', () => {
    show(
      ready([
        departure({ id: 'late', time: at(9, 12), status: 'delayed' }),
        departure({ id: 'nearly', time: at(30, 0) }),
      ]),
    );
    expect(screen.getByText('10:21').getAttribute('data-inverted')).toBe('true');
    expect(screen.queryByText(/Verspätung/)).toBeNull();
  });

  it('inverts a changed platform', () => {
    show(
      ready([departure({ id: 'moved', platform: { planned: '9', actual: '4', changed: true } })]),
    );
    expect(screen.getByText('4').getAttribute('data-inverted')).toBe('true');
  });

  it('says a cancelled train does not run in place of its via stops', () => {
    show(
      ready([
        departure({
          id: 'x',
          status: 'cancelled',
          via: route('Bad Vilbel'),
          time: at(11, 5),
        }),
      ]),
    );
    expect(screen.getByText(/Zug fällt aus/).closest('[data-inverted="true"]')).not.toBeNull();
    expect(screen.queryByText('Bad Vilbel')).toBeNull();
    // A train that does not run has no expected time.
    expect(screen.queryByText('10:16')).toBeNull();
  });

  it('words skipped stops in place of the via stops', () => {
    show(
      ready([
        departure({
          id: 'x',
          via: route('Solingen Hbf'),
          routeChanges: [{ kind: 'skippedStops', stops: route('Köln Hbf') }],
        }),
      ]),
    );
    expect(screen.getByText(/Ohne Halt in Köln Hbf/)).toBeDefined();
  });

  it('does not list a train that ends here, and fills its line with the next departure', () => {
    const entries = Array.from({ length: 12 }, (_, index) =>
      departure({ id: `t${index}`, time: at(10 + index) }),
    );
    show(ready([terminating, ...entries]));
    expect(screen.queryByText('RB61')).toBeNull();
    expect(screen.queryByText('Bitte nicht einsteigen')).toBeNull();
    expect(screen.getAllByText('ICE 571')).toHaveLength(12);
  });

  it('joins the parts of a coupled train, with the time on the first only', () => {
    const shared = route('Friedberg(Hess)', 'Gießen');
    const container = show(
      ready([
        departure({
          id: 'a',
          time: at(2),
          destination: { name: 'Kassel Hbf' },
          via: [...shared, { name: 'Marburg(Lahn)' }],
          coupledWith: ['b'],
        }),
        departure({
          id: 'b',
          time: at(2),
          destination: { name: 'Siegen Hbf' },
          via: [...shared, { name: 'Wetzlar' }],
          coupledWith: ['a'],
        }),
      ]),
    );
    expect(screen.getAllByText('10:02')).toHaveLength(1);
    expect(dots(container)).toHaveLength(1);
    // Both lists mark where the parts separate.
    expect(screen.getAllByRole('img', { name: 'Zugteilung' })).toHaveLength(2);
  });

  it('says so when the data is old, in place of the last line', () => {
    const entries = Array.from({ length: 12 }, (_, index) =>
      departure({ id: `t${index}`, time: at(10 + index) }),
    );
    show(ready(entries, { stale: true }));
    expect(screen.getByText(/Daten nicht aktuell/)).toBeDefined();
    expect(screen.getAllByText('ICE 571')).toHaveLength(11);
  });

  it('shows no clock and no train before the first board arrives', () => {
    show({ state: 'loading' });
    expect(screen.queryByRole('img', { name: 'Uhrzeit' })).toBeNull();
    expect(screen.getByText('Abfahrt')).toBeDefined();
  });

  it('says when no data arrives at all', () => {
    show({ state: 'unavailable' });
    expect(screen.getByText(/Derzeit keine Zugdaten/)).toBeDefined();
  });
});
