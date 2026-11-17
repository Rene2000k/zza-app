import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { V3_5x2 } from './V3_5x2';
import type { DepartureEntry, EntryTime, TerminatingArrivalEntry } from '@/domain/boardEntry';
import type { BoardMessage } from '@/domain/message';
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

const show = (board: ZzaBoardViewModel) => render(<V3_5x2 board={board} />).container;

const invertedFields = (container: HTMLElement) =>
  container.querySelectorAll('[data-inverted="true"]');

const delayedBy = (minutes: number) =>
  ready({ current: departure({ id: 'late', time: at(9, minutes), status: 'delayed' }) });

describe('V3 5X2 design', () => {
  it('shows the main train with its planned time, train and destination', () => {
    show(ready({ current: departure({ id: 'ice' }) }));
    expect(screen.getByText('10:04')).toBeDefined();
    expect(screen.getByText('ICE 571')).toBeDefined();
    expect(screen.getByText('Stuttgart Hbf')).toBeDefined();
  });

  it('shows the next three via stops in travel order', () => {
    const via = ['Bad Vilbel', 'Friedberg', 'Butzbach', 'Bad Nauheim', 'Gießen Oswaldsgarten'];
    show(ready({ current: departure({ id: 're', via: via.map((name) => ({ name })) }) }));
    expect(screen.getByText('Bad Vilbel - Friedberg - Butzbach')).toBeDefined();
  });

  it('words the main train delay in the running line and gives following trains a +7 field', () => {
    const container = show(
      ready({
        current: departure({ id: 'late', time: at(9, 12), status: 'delayed' }),
        following: [departure({ id: 'later', time: at(20, 7), status: 'delayed' })],
      }),
    );
    expect(screen.getByText('Verspätung ca. 10 Min.')).toBeDefined();
    expect(screen.queryByText('+12')).toBeNull();
    expect(screen.getByText('+7').getAttribute('data-inverted')).toBe('true');
    expect(invertedFields(container)).toHaveLength(2);
  });

  it('rounds the announced delay down to five minutes and says nothing below five', () => {
    const { container, rerender } = render(<V3_5x2 board={delayedBy(14)} />);
    expect(screen.getByText('Verspätung ca. 10 Min.')).toBeDefined();

    rerender(<V3_5x2 board={delayedBy(5)} />);
    expect(screen.getByText('Verspätung ca. 5 Min.')).toBeDefined();

    rerender(<V3_5x2 board={delayedBy(4)} />);
    expect(screen.queryByText(/Verspätung/)).toBeNull();
    expect(invertedFields(container)).toHaveLength(0);
  });

  it('leaves delay causes and disruption reports out of the running line', () => {
    const container = show(
      ready({
        current: departure({
          id: 'x',
          time: at(9, 3),
          status: 'delayed',
          messages: [
            { kind: 'delayCause', code: '43', text: 'Verspätung eines vorausfahrenden Zuges' },
            { kind: 'disruption', text: 'Störung' },
          ],
        }),
      }),
    );
    expect(screen.queryByText(/vorausfahrenden/)).toBeNull();
    expect(screen.queryByText(/Störung/)).toBeNull();
    expect(invertedFields(container)).toHaveLength(0);
  });

  it('runs the quality notices whose topic it shows, in the wording the source gave', () => {
    const container = show(
      ready({
        current: departure({
          id: 'x',
          messages: [
            { kind: 'qualityNotice', code: '85', topic: 'missingCoaches', text: 'Ein Wagen fehlt' },
          ],
        }),
      }),
    );
    expect(screen.getByText(/Ein Wagen fehlt/)).toBeDefined();
    expect(invertedFields(container)).toHaveLength(1);
  });

  it('leaves out the quality topics this display does not announce', () => {
    const container = show(
      ready({
        current: departure({
          id: 'x',
          messages: [
            {
              kind: 'qualityNotice',
              code: '70',
              topic: 'onboardServices',
              text: 'WLAN nicht verfügbar',
            },
            {
              kind: 'qualityNotice',
              code: '86',
              topic: 'reservation',
              text: 'Gesamter Zug ohne Reservierung',
            },
            { kind: 'qualityNotice', code: '98', topic: 'other', text: 'Sonstige Qualitätsmängel' },
          ],
        }),
      }),
    );
    expect(screen.queryByText(/WLAN/)).toBeNull();
    expect(screen.queryByText(/Reservierung/)).toBeNull();
    expect(screen.queryByText(/Qualitätsmängel/)).toBeNull();
    expect(invertedFields(container)).toHaveLength(0);
  });

  it('runs a quality notice behind a following train too', () => {
    show(
      ready({
        current: departure({ id: 'main' }),
        following: [
          departure({
            id: 'next',
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
    expect(screen.getByText(/Fahrradmitnahme nicht möglich/)).toBeDefined();
  });

  describe('coupled trains (ADR-0014)', () => {
    const route = (...names: string[]) => names.map((name) => ({ name }));
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
    const later = departure({ id: 'later', destination: { name: 'Stuttgart Hbf' } });

    it('shows the second part in the lower row, in place of the following trains', () => {
      show(ready({ current: toKassel, secondPart: toSiegen, following: [later] }));
      expect(screen.getByText('Kassel Hbf')).toBeDefined();
      expect(screen.getByText('Siegen Hbf')).toBeDefined();
      expect(screen.getByText('RE99')).toBeDefined();
      expect(screen.getByText('HLB 15112')).toBeDefined();
      expect(screen.getAllByText('10:04')).toHaveLength(2);
      expect(screen.getByText('Friedberg(Hess) - Gießen - Wetzlar')).toBeDefined();
      expect(screen.queryByText('Folgezüge:')).toBeNull();
      expect(screen.queryByText('Stuttgart Hbf')).toBeNull();
    });

    it('names the split stop in the running lines of both parts', () => {
      show(ready({ current: toKassel, secondPart: toSiegen }));
      expect(screen.getAllByText('Zug wird in Gießen geteilt')).toHaveLength(2);
    });

    it('runs what concerns one part in that part’s line only', () => {
      const late = departure({ ...toSiegen, time: at(4, 10), status: 'delayed' });
      show(ready({ current: toKassel, secondPart: late }));
      expect(screen.getByText('Zug wird in Gießen geteilt')).toBeDefined();
      expect(
        screen.getByText('Zug wird in Gießen geteilt +++ Verspätung ca. 10 Min.'),
      ).toBeDefined();
    });
  });

  it('runs a quality notice after the delay, separated by +++', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          time: at(9, 10),
          status: 'delayed',
          messages: [
            { kind: 'qualityNotice', code: '85', topic: 'missingCoaches', text: 'Ein Wagen fehlt' },
          ],
        }),
      }),
    );
    expect(screen.getByText('Verspätung ca. 10 Min. +++ Ein Wagen fehlt')).toBeDefined();
  });

  it('names every skipped stop in the running line', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          routeChanges: [
            {
              kind: 'skippedStops',
              stops: [{ name: 'Gelsenkirchen Hbf' }, { name: 'Duisburg Hbf' }],
            },
          ],
        }),
      }),
    );
    expect(screen.getByText(/Heute ohne Halt in Gelsenkirchen Hbf, Duisburg Hbf/)).toBeDefined();
  });

  it('words a shortened run with the destination the train really reaches', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          destination: { name: 'Neustadt am Rübenberge' },
          routeChanges: [
            { kind: 'endsEarly', stops: [{ name: 'Linsburg' }, { name: 'Nienburg(Weser)' }] },
          ],
        }),
      }),
    );
    expect(screen.getByText(/Heute nur bis Neustadt am Rübenberge/)).toBeDefined();
    // The stops it no longer reaches are carried, but this design does not read them out.
    expect(screen.queryByText(/Nienburg/)).toBeNull();
  });

  it('announces an additional stop', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          routeChanges: [{ kind: 'additionalStops', stops: [{ name: 'Hamburg-Harburg' }] }],
        }),
      }),
    );
    expect(screen.getByText(/Heute mit zusätzlichem Halt in Hamburg-Harburg/)).toBeDefined();
  });

  it('runs a diversion as two statements in one line', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          routeChanges: [
            { kind: 'skippedStops', stops: [{ name: 'Duisburg Hbf' }] },
            { kind: 'additionalStops', stops: [{ name: 'Solingen Hbf' }] },
          ],
        }),
      }),
    );
    expect(
      screen.getByText(
        'Heute ohne Halt in Duisburg Hbf +++ Heute mit zusätzlichem Halt in Solingen Hbf',
      ),
    ).toBeDefined();
  });

  it('marks a diversion of the main train with H+ and H−, in that order', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          routeChanges: [
            { kind: 'skippedStops', stops: [{ name: 'Duisburg Hbf' }] },
            { kind: 'additionalStops', stops: [{ name: 'Solingen Hbf' }] },
          ],
        }),
      }),
    );
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('aria-label'))).toEqual([
      'Zusätzlicher Halt',
      'Halt entfällt',
    ]);
  });

  it('shows no halt box for a following train, which has no room for one', () => {
    show(
      ready({
        current: departure({ id: 'main' }),
        following: [
          departure({
            id: 'next',
            routeChanges: [{ kind: 'additionalStops', stops: [{ name: 'Hamburg-Harburg' }] }],
          }),
        ],
      }),
    );
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('runs a route change behind a following train too', () => {
    show(
      ready({
        current: departure({ id: 'main' }),
        following: [
          departure({
            id: 'next',
            routeChanges: [{ kind: 'skippedStops', stops: [{ name: 'Offenbach(Main)Hbf' }] }],
          }),
        ],
      }),
    );
    expect(screen.getByText(/Heute ohne Halt in Offenbach\(Main\)Hbf/)).toBeDefined();
  });

  it('draws no white bar where there is nothing to say', () => {
    const container = show(ready({ current: departure({ id: 'quiet' }) }));
    expect(invertedFields(container)).toHaveLength(0);
  });

  it('runs every notice for the main train in one line, separated by +++', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          time: at(9, 10),
          status: 'delayed',
          platform: { planned: '9', actual: '4', changed: true },
        }),
      }),
    );
    const line = screen.getByText('Verspätung ca. 10 Min. +++ Heute von Gleis 4');
    expect(line.closest('[data-inverted]')?.getAttribute('data-inverted')).toBe('true');
  });

  it('words a cancellation in the source’s own text, where the source puts it', () => {
    const messages: BoardMessage[] = [
      { kind: 'qualityNotice', code: '85', topic: 'missingCoaches', text: 'Ein Wagen fehlt' },
      { kind: 'cancellation', code: '80', text: 'Fällt heute aus' },
    ];
    show(ready({ current: departure({ id: 'x', status: 'cancelled', messages }) }));
    expect(screen.getByText('Ein Wagen fehlt +++ Fällt heute aus')).toBeDefined();
    expect(screen.queryByText(/Zug fällt aus/)).toBeNull();
  });

  it('words a following train’s cancellation in the source’s text, where the source puts it', () => {
    const messages: BoardMessage[] = [
      { kind: 'qualityNotice', code: '85', topic: 'missingCoaches', text: 'Ein Wagen fehlt' },
      { kind: 'cancellation', code: '80', text: 'Fällt heute aus' },
    ];
    show(
      ready({
        current: departure({ id: 'x' }),
        following: [departure({ id: 'y', time: at(20), status: 'cancelled', messages })],
      }),
    );
    expect(screen.getByText('Ein Wagen fehlt +++ Fällt heute aus')).toBeDefined();
    expect(screen.queryByText(/^Fällt aus/)).toBeNull();
  });

  it('words a cancellation itself where the source gives no text', () => {
    show(ready({ current: departure({ id: 'x', status: 'cancelled' }) }));
    expect(screen.getByText('Zug fällt aus')).toBeDefined();
  });

  it('announces no route change and shows no halt box for a cancelled train', () => {
    show(
      ready({
        current: departure({
          id: 'x',
          status: 'cancelled',
          routeChanges: [{ kind: 'skippedStops', stops: [{ name: 'Duisburg Hbf' }] }],
        }),
      }),
    );
    expect(screen.getByText('Zug fällt aus')).toBeDefined();
    expect(screen.queryByText(/Heute ohne Halt/)).toBeNull();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('announces a replacement train in the running line', () => {
    show(ready({ current: departure({ id: 'x', status: 'replacement' }) }));
    expect(screen.getByText('Ersatzzug')).toBeDefined();
  });

  it('announces a platform change as text and keeps the platform it stands at', () => {
    show(
      ready({
        current: departure({ id: 'x', platform: { planned: '9', actual: '4', changed: true } }),
      }),
    );
    expect(screen.getByText('Heute von Gleis 4')).toBeDefined();
    expect(screen.getByText('9')).toBeDefined();
  });

  it('leads a train ending here with its origin and keeps people off it', () => {
    show(ready({ current: terminating, following: [terminating] }));
    expect(screen.getAllByText('von Dieburg')).toHaveLength(2);
    expect(screen.getByText('Bitte nicht einsteigen')).toBeDefined();
    expect(screen.getByText('Fahrt endet hier')).toBeDefined();
    expect(screen.getByText('Zug endet hier')).toBeDefined();
  });

  it('says in its running line that a following train left this platform', () => {
    show(
      ready({
        following: [departure({ id: 'x', platform: { planned: '9', actual: '4', changed: true } })],
      }),
    );
    expect(screen.getByText('Heute von Gleis 4')).toBeDefined();
  });

  it('marks a cancelled following train in its own running line', () => {
    show(ready({ following: [departure({ id: 'x', status: 'cancelled' })] }));
    expect(screen.getByText('Fällt aus')).toBeDefined();
  });

  it('shows two following trains and no more', () => {
    show(
      ready({
        following: ['Mainz Hbf', 'Hanau Hbf', 'Fulda'].map((name, index) =>
          departure({ id: name, time: at(10 + index), destination: { name } }),
        ),
      }),
    );
    expect(screen.getByText('Mainz Hbf')).toBeDefined();
    expect(screen.getByText('Hanau Hbf')).toBeDefined();
    expect(screen.queryByText('Fulda')).toBeNull();
  });

  it('leaves the coach area empty without a coach sequence', () => {
    const container = show(ready({ current: departure({ id: 'x' }) }));
    expect(container.querySelector('[data-state]')).toBeNull();
  });

  it('keeps its label while the first fetch runs, and nothing else', () => {
    const container = show({ state: 'loading' });
    expect(screen.getByText('Folgezüge:')).toBeDefined();
    expect(invertedFields(container)).toHaveLength(0);
  });

  it('says so when the source has not answered', () => {
    show({ state: 'unavailable' });
    expect(screen.getByText('Derzeit keine Zugdaten')).toBeDefined();
  });

  it('gives stale data the running line only while no train text needs it', () => {
    const { rerender } = render(
      <V3_5x2 board={ready({ current: departure({ id: 'x' }), stale: true })} />,
    );
    expect(screen.getByText('Daten nicht aktuell')).toBeDefined();

    rerender(<V3_5x2 board={{ ...delayedBy(10), stale: true }} />);
    expect(screen.queryByText('Daten nicht aktuell')).toBeNull();
    expect(screen.getByText('Verspätung ca. 10 Min.')).toBeDefined();
  });
});
