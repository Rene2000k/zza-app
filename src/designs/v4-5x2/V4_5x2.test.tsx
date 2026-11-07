import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { V4_5x2 } from './V4_5x2';
import type { DepartureEntry, EntryTime, TerminatingArrivalEntry } from '@/domain/boardEntry';
import type { ReadyBoard, ZzaBoardViewModel } from '@/hooks/useZzaBoard';

const at = (minutes: number, delay = 0): EntryTime => {
  // 08:00 UTC is 10:00 at the station.
  const planned = new Date(Date.UTC(2026, 8, 11, 8, minutes));
  return { planned, expected: new Date(planned.getTime() + delay * 60_000) };
};

const departure = (overrides: Partial<DepartureEntry> & { id: string }): DepartureEntry => ({
  kind: 'departure',
  train: { category: 'ICE', number: '571' },
  platform: { planned: '9', actual: '9', changed: false },
  time: at(4),
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
  platform: { planned: '9', actual: '9', changed: false },
  time: at(8),
  status: 'onTime',
  messages: [],
  origin: { name: 'Dieburg' },
};

const ready = (overrides: Partial<ReadyBoard>): ReadyBoard => ({
  state: 'ready',
  station: { evaNumber: '8000105', name: 'Frankfurt(Main)Hbf' },
  platform: '9',
  current: undefined,
  secondPart: undefined,
  following: [],
  entries: [],
  now: new Date(Date.UTC(2026, 8, 11, 8, 0)),
  messages: [],
  dataAgeSeconds: 4,
  stale: false,
  ...overrides,
});

const show = (board: ZzaBoardViewModel) => render(<V4_5x2 board={board} />).container;

const invertedFields = (container: HTMLElement) =>
  container.querySelectorAll('[data-inverted="true"]');

const ruledLines = (container: HTMLElement) => container.querySelectorAll('[data-ruled="true"]');

const route = (...names: string[]) => names.map((name) => ({ name }));

describe('V4 5X2 design', () => {
  it('shows the main train with its planned time, train and destination', () => {
    show(ready({ current: departure({ id: 'ice' }) }));
    expect(screen.getByText('10:04')).toBeDefined();
    expect(screen.getByText('ICE 571')).toBeDefined();
    expect(screen.getByText('Stuttgart Hbf')).toBeDefined();
  });

  it('has no platform field', () => {
    show(ready({ current: departure({ id: 'ice' }) }));
    expect(screen.queryByText('9')).toBeNull();
  });

  it('shows four via stops on one line while a running line takes the band above', () => {
    const via = route('Bad Vilbel', 'Friedberg', 'Butzbach', 'Bad Nauheim', 'Gießen');
    show(ready({ current: departure({ id: 're', via, status: 'replacement' }) }));
    expect(screen.getByText('Bad Vilbel - Friedberg - Butzbach - Bad Nauheim')).toBeDefined();
  });

  it('lets the via stops take two lines while nothing runs above them', () => {
    const names = ['Würzburg Hbf', 'Fulda', 'Kassel-Wilhelmshöhe', 'Göttingen'];
    const names2 = ['Hannover Hbf', 'Lüneburg', 'Hamburg-Harburg'];
    show(ready({ current: departure({ id: 'ice', via: route(...names, ...names2) }) }));
    // Each stop stays whole, and the separator stays with the stop before it.
    expect(screen.getByText('Würzburg Hbf -')).toBeDefined();
    expect(screen.getByText('Lüneburg')).toBeDefined();
    expect(screen.queryByText(/Hamburg-Harburg/)).toBeNull();
  });

  it('prints the expected time inverted beside the planned one and words no delay', () => {
    const container = show(
      ready({
        current: departure({ id: 'late', time: at(9, 12), status: 'delayed' }),
        following: [departure({ id: 'later', time: at(20, 7), status: 'delayed' })],
      }),
    );
    expect(screen.getByText('10:21').getAttribute('data-inverted')).toBe('true');
    expect(screen.getByText('10:27').getAttribute('data-inverted')).toBe('true');
    expect(screen.queryByText(/Verspätung/)).toBeNull();
    expect(screen.queryByText('+12')).toBeNull();
    expect(invertedFields(container)).toHaveLength(2);
  });

  it('shows no expected time below a full minute of delay, nor for a cancelled train', () => {
    const container = show(
      ready({
        current: departure({ id: 'x', time: at(9, 0) }),
        following: [departure({ id: 'y', time: at(20, 7), status: 'cancelled' })],
      }),
    );
    expect(screen.queryByText('10:27')).toBeNull();
    // Only the cancelled row itself is inverted.
    expect(invertedFields(container)).toHaveLength(1);
  });

  it('runs train notices above a rule, not inverted', () => {
    const container = show(ready({ current: departure({ id: 'x', status: 'replacement' }) }));
    expect(screen.getByText('Ersatzzug')).toBeDefined();
    expect(ruledLines(container)).toHaveLength(1);
    expect(invertedFields(container)).toHaveLength(0);
  });

  it('leaves delay causes and disruption reports out of the running line', () => {
    const container = show(
      ready({
        current: departure({ id: 'x' }),
        messages: [
          { kind: 'delayCause', code: '43', text: 'Verspätung eines vorausfahrenden Zuges' },
          { kind: 'disruption', text: 'Störung' },
        ],
      }),
    );
    expect(screen.queryByText(/vorausfahrenden/)).toBeNull();
    expect(screen.queryByText(/Störung/)).toBeNull();
    expect(ruledLines(container)).toHaveLength(0);
  });

  it('runs the quality notices whose topic it shows, and leaves out the others', () => {
    show(
      ready({
        current: departure({ id: 'x' }),
        messages: [
          { kind: 'qualityNotice', code: '85', topic: 'missingCoaches', text: 'Ein Wagen fehlt' },
          {
            kind: 'qualityNotice',
            code: '70',
            topic: 'onboardServices',
            text: 'WLAN nicht verfügbar',
          },
        ],
      }),
    );
    expect(screen.getByText('Ein Wagen fehlt')).toBeDefined();
    expect(screen.queryByText(/WLAN/)).toBeNull();
  });

  it('runs every notice for the main train in one line, separated by +++', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          status: 'replacement',
          platform: { planned: '9', actual: '4', changed: true },
        }),
      }),
    );
    expect(screen.getByText('Ersatzzug +++ Heute von Gleis 4')).toBeDefined();
  });

  it('does not announce a cancellation twice when the source already words it', () => {
    show(
      ready({
        current: departure({ id: 'x', status: 'cancelled' }),
        messages: [{ kind: 'cancellation', code: '80', text: 'Zug fällt aus' }],
      }),
    );
    expect(screen.getByText('Zug fällt aus')).toBeDefined();
  });

  it('words route changes and marks the main train with H+ and H−, in that order', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          routeChanges: [
            { kind: 'skippedStops', stops: route('Duisburg Hbf') },
            { kind: 'additionalStops', stops: route('Solingen Hbf') },
          ],
        }),
      }),
    );
    expect(
      screen.getByText(
        'Heute ohne Halt in Duisburg Hbf +++ Heute mit zusätzlichem Halt in Solingen Hbf',
      ),
    ).toBeDefined();
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('aria-label'))).toEqual([
      'Zusätzlicher Halt',
      'Halt entfällt',
    ]);
  });

  it('words a shortened run with the destination the train really reaches', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          destination: { name: 'Neustadt am Rübenberge' },
          routeChanges: [{ kind: 'endsEarly', stops: route('Linsburg', 'Nienburg(Weser)') }],
        }),
      }),
    );
    expect(screen.getByText('Heute nur bis Neustadt am Rübenberge')).toBeDefined();
    expect(screen.queryByText(/Nienburg/)).toBeNull();
  });

  describe('following trains', () => {
    it('shows two following trains on one line each, and no more', () => {
      show(
        ready({
          current: departure({ id: 'main' }),
          following: [
            departure({ id: 'a', time: at(10), destination: { name: 'Mainz Hbf' } }),
            departure({
              id: 'b',
              time: at(11),
              train: { category: 'RE', number: '4168', line: 'RE55' },
              destination: { name: 'Würzburg Hbf' },
              via: route('Hanau Hbf', 'Aschaffenburg Hbf'),
            }),
            departure({ id: 'c', time: at(12), destination: { name: 'Fulda' } }),
          ],
        }),
      );
      expect(screen.getByText('ICE 571 Mainz Hbf')).toBeDefined();
      expect(screen.getByText('RE55 Würzburg Hbf via Hanau Hbf')).toBeDefined();
      expect(screen.queryByText(/Fulda/)).toBeNull();
    });

    it('inverts a cancelled train, marks its time and says why', () => {
      const container = show(
        ready({ following: [departure({ id: 'x', time: at(20, 7), status: 'cancelled' })] }),
      );
      expect(screen.getByText('× 10:20')).toBeDefined();
      expect(screen.getByText('ICE 571 Stuttgart Hbf Zug fällt aus')).toBeDefined();
      expect(invertedFields(container)).toHaveLength(1);
    });

    it('inverts a train that changed away and points to its platform', () => {
      const container = show(
        ready({
          following: [
            departure({ id: 'x', platform: { planned: '9', actual: '6', changed: true } }),
          ],
        }),
      );
      expect(screen.getByRole('img', { name: 'Gleiswechsel' })).toBeDefined();
      expect(screen.getByText(/Gleis 6/)).toBeDefined();
      expect(invertedFields(container)).toHaveLength(1);
    });

    it('leaves a train that changed to this platform as it is', () => {
      const container = show(
        ready({
          following: [
            departure({ id: 'x', platform: { planned: '4', actual: '9', changed: true } }),
          ],
        }),
      );
      expect(screen.queryByRole('img')).toBeNull();
      expect(invertedFields(container)).toHaveLength(0);
    });

    it('carries route changes, quality notices and halt boxes', () => {
      show(
        ready({
          following: [
            departure({
              id: 'x',
              routeChanges: [{ kind: 'additionalStops', stops: route('Hamburg-Harburg') }],
              messages: [
                {
                  kind: 'qualityNotice',
                  code: '91',
                  topic: 'bicycle',
                  text: 'Fahrradmitnahme nicht möglich',
                },
              ],
            }),
          ],
        }),
      );
      expect(
        screen.getByText(
          'ICE 571 Stuttgart Hbf Heute mit zusätzlichem Halt in Hamburg-Harburg Fahrradmitnahme nicht möglich',
        ),
      ).toBeDefined();
      expect(screen.getByRole('img', { name: 'Zusätzlicher Halt' })).toBeDefined();
    });

    it('names where a train ending here comes from', () => {
      show(ready({ current: departure({ id: 'main' }), following: [terminating] }));
      expect(screen.getByText('RB61 Ankunft von Dieburg')).toBeDefined();
    });
  });

  describe('a train ending here', () => {
    it('keeps people off it and says in large type that it ends', () => {
      show(ready({ current: terminating, following: [departure({ id: 'next' })] }));
      expect(screen.getByText('Bitte nicht einsteigen')).toBeDefined();
      expect(screen.getByText('von Dieburg')).toBeDefined();
      expect(screen.getByText('RB61')).toBeDefined();
      expect(screen.getByText('10:08')).toBeDefined();
      expect(screen.getByText('Zug endet hier')).toBeDefined();
      expect(screen.getByText('ICE 571 Stuttgart Hbf')).toBeDefined();
    });

    it('runs its notices inverted across the full width', () => {
      const container = show(
        ready({
          current: { ...terminating, platform: { planned: '9', actual: '4', changed: true } },
        }),
      );
      expect(screen.getByText('Heute von Gleis 4').closest('[data-inverted]')).not.toBeNull();
      expect(invertedFields(container)).toHaveLength(1);
      expect(ruledLines(container)).toHaveLength(0);
    });

    it('prints its expected time too', () => {
      show(ready({ current: { ...terminating, time: at(8, 20), status: 'delayed' } }));
      expect(screen.getByText('10:28').getAttribute('data-inverted')).toBe('true');
    });
  });

  describe('coupled trains (ADR-0014)', () => {
    const toKassel = departure({
      id: 'hlb-15012',
      train: { category: 'HLB', number: '15012', line: 'RE99' },
      destination: { name: 'Kassel Hbf' },
      via: route('Friedberg(Hess)', 'Gießen', 'Marburg(Lahn)'),
      coupledWith: ['hlb-15112'],
    });
    const toSiegen = departure({
      id: 'hlb-15112',
      train: { category: 'HLB', number: '15112' },
      destination: { name: 'Siegen Hbf' },
      via: route('Friedberg(Hess)', 'Gießen', 'Wetzlar'),
      coupledWith: ['hlb-15012'],
    });
    const later = (name: string, minutes: number) =>
      departure({ id: name, time: at(minutes), destination: { name } });

    it('shows the second part in the lower row and keeps one following train', () => {
      show(
        ready({
          current: toKassel,
          secondPart: toSiegen,
          following: [later('Mainz Hbf', 20), later('Fulda', 30)],
        }),
      );
      expect(screen.getByText('Kassel Hbf')).toBeDefined();
      expect(screen.getByText('Siegen Hbf')).toBeDefined();
      expect(screen.getByText('RE99')).toBeDefined();
      expect(screen.getByText('HLB 15112')).toBeDefined();
      // Both leave together: one time.
      expect(screen.getAllByText('10:04')).toHaveLength(1);
      expect(screen.getByText('ICE 571 Mainz Hbf')).toBeDefined();
      expect(screen.queryByText(/Fulda/)).toBeNull();
    });

    it('announces the split above the first part only', () => {
      show(ready({ current: toKassel, secondPart: toSiegen }));
      expect(screen.getAllByText('Zug wird in Gießen geteilt')).toHaveLength(1);
    });

    it('gives the second part its via stops and marks the split stop in both lists', () => {
      const container = show(ready({ current: toKassel, secondPart: toSiegen }));
      expect(container.textContent).toContain('Wetzlar');
      expect(container.textContent).toContain('Marburg(Lahn)');
      const marks = screen.getAllByRole('img', { name: 'Zugteilung' });
      expect(marks).toHaveLength(2);
      // The mark is an item of its own, right after the stop where the parts separate.
      for (const mark of marks) {
        const separator = mark.parentElement?.previousSibling;
        expect(separator?.textContent).toBe(' - ');
        expect(separator?.previousSibling?.textContent).toBe('Gießen');
      }
    });

    it('runs a notice of the second part alone in place of its via stops', () => {
      const late = departure({ ...toSiegen, time: at(4, 10), status: 'delayed' });
      const container = show(ready({ current: toKassel, secondPart: late }));
      expect(screen.getByText('Verspätung ca. 10 Min.')).toBeDefined();
      expect(container.textContent).not.toContain('Wetzlar');
      expect(screen.getAllByRole('img', { name: 'Zugteilung' })).toHaveLength(1);
    });

    it('announces and marks no split when one part does not run', () => {
      show(
        ready({ current: toKassel, secondPart: departure({ ...toSiegen, status: 'cancelled' }) }),
      );
      expect(screen.queryByText(/geteilt/)).toBeNull();
      expect(screen.queryByRole('img', { name: 'Zugteilung' })).toBeNull();
      expect(screen.getByText('Zug fällt aus')).toBeDefined();
    });
  });

  it('leaves the coach area empty without a coach sequence', () => {
    const container = show(ready({ current: departure({ id: 'x' }) }));
    expect(container.querySelector('[data-state]')).toBeNull();
  });

  it('shows the coach sequence when there is one', () => {
    const container = show(
      ready({
        current: departure({
          id: 'x',
          formation: {
            accuracy: 'scheduled',
            sections: ['A', 'B'],
            coaches: [
              { number: '1', travelClass: 'first', features: [] },
              { number: '2', travelClass: 'second', features: [] },
            ],
          },
        }),
      }),
    );
    expect(container.querySelector('[data-state="formation"]')).not.toBeNull();
  });

  it('shows nothing at all while the first fetch runs', () => {
    const container = show({ state: 'loading' });
    expect(container.textContent).toBe('');
  });

  it('says so across the full width when the source has not answered', () => {
    show({ state: 'unavailable' });
    const notice = screen.getByText('Derzeit keine Zugdaten');
    expect(notice.closest('[data-inverted="true"]')).not.toBeNull();
  });

  it('gives stale data the top band only while no train text needs it', () => {
    const { rerender } = render(
      <V4_5x2 board={ready({ current: departure({ id: 'x' }), stale: true })} />,
    );
    expect(screen.getByText('Daten nicht aktuell')).toBeDefined();

    rerender(
      <V4_5x2
        board={ready({ current: departure({ id: 'x', status: 'replacement' }), stale: true })}
      />,
    );
    expect(screen.queryByText('Daten nicht aktuell')).toBeNull();
    expect(screen.getByText('Ersatzzug')).toBeDefined();
  });
});
