import type { DepartureEntry, EntryTime, TerminatingArrivalEntry } from '@/domain/boardEntry';
import type { StationRef } from '@/domain/station';
import type { ReadyBoard, ZzaBoardViewModel } from '@/hooks/useZzaBoard';

/**
 * Named datasets for the design playground: every display state that is awkward to wait for
 * in reality — a cancellation, a platform change, a name too long for its field, no data at
 * all.
 *
 * They are view models rather than provider responses on purpose: loading, "nothing arrived
 * yet" and "data has gone stale" cannot be ordered from a provider, and a fixed dataset
 * makes two runs of the same scenario comparable down to the pixel.
 */
export interface PreviewScenario {
  readonly id: string;
  readonly name: string;
  readonly board: ZzaBoardViewModel;
}

const station: StationRef = { evaNumber: '8000105', name: 'Frankfurt(Main)Hbf', ds100: 'FF' };

const reference = new Date('2026-09-11T10:52:00+02:00');
const at = (offsetMinutes: number, delayMinutes = 0): EntryTime => {
  const planned = new Date(reference.getTime() + offsetMinutes * 60_000);
  return { planned, expected: new Date(planned.getTime() + delayMinutes * 60_000) };
};

const departure = (overrides: Partial<DepartureEntry> & { id: string }): DepartureEntry => ({
  kind: 'departure',
  train: { category: 'ICE', number: '571' },
  platform: { planned: '9', actual: '9', changed: false },
  time: at(4),
  status: 'onTime',
  messages: [],
  destination: { name: 'Stuttgart Hbf' },
  via: [{ name: 'Frankfurt(M) Flughafen Fernbf' }, { name: 'Mannheim Hbf' }],
  ...overrides,
});

const ready = (overrides: Partial<ReadyBoard>): ReadyBoard => ({
  state: 'ready',
  station,
  platform: '9',
  current: undefined,
  following: [],
  messages: [],
  dataAgeSeconds: 4,
  stale: false,
  ...overrides,
});

const ice: DepartureEntry = departure({ id: 'ice-571' });

const regional: DepartureEntry = departure({
  id: 're-4168',
  train: { category: 'RE', number: '4168', line: 'RE60' },
  time: at(9, 12),
  status: 'delayed',
  messages: [
    { kind: 'delayCause', code: '43', text: 'Verspätung eines vorausfahrenden Zuges' },
    { kind: 'delayCause', code: '9999' },
  ],
  destination: { name: 'Gießen' },
  via: [{ name: 'Bad Vilbel' }, { name: 'Friedberg(Hess)' }],
});

const movedAway: DepartureEntry = departure({
  id: 're-4271',
  train: { category: 'RE', number: '4271', line: 'RE59' },
  platform: { planned: '9', actual: '4', changed: true },
  time: at(6, 3),
  status: 'delayed',
  messages: [{ kind: 'info', code: '900', text: 'Gleiswechsel' }],
  destination: { name: 'Wiesbaden Hbf' },
  via: [{ name: 'Rüsselsheim' }],
});

const cancelled: DepartureEntry = departure({
  id: 'rb-15702',
  train: { category: 'RB', number: '15702', line: 'RB58' },
  time: at(11),
  status: 'cancelled',
  messages: [{ kind: 'cancellation', code: '80', text: 'Zug fällt aus' }],
  destination: { name: 'Bamberg' },
  via: [],
});

/** Runs in place of the cancelled RB 15702. */
const replacement: DepartureEntry = departure({
  id: 'rb-15792',
  train: { category: 'RB', number: '15792', line: 'RB58' },
  time: at(12),
  status: 'replacement',
  destination: { name: 'Bamberg' },
  via: [{ name: 'Aschaffenburg Hbf' }, { name: 'Würzburg Hbf' }],
});

const terminating: TerminatingArrivalEntry = {
  kind: 'terminatingArrival',
  id: 'rb-15645',
  train: { category: 'RB', number: '15645', line: 'RB61' },
  platform: { planned: '9', actual: '9', changed: false },
  time: at(8, 2),
  status: 'delayed',
  messages: [],
  origin: { name: 'Dieburg' },
};

const longName: DepartureEntry = departure({
  id: 'ice-1006',
  train: { category: 'ICE', number: '1006' },
  time: at(14, 3),
  status: 'delayed',
  destination: { name: 'Berlin Gesundbrunnen über Kassel-Wilhelmshöhe' },
  via: [
    { name: 'Frankfurt(M) Flughafen Fernbf' },
    { name: 'Kassel-Wilhelmshöhe' },
    { name: 'Göttingen' },
    { name: 'Braunschweig Hbf' },
    { name: 'Berlin Südkreuz' },
  ],
});

export const previewScenarios: readonly PreviewScenario[] = [
  {
    id: 'regelbetrieb',
    name: 'Regelbetrieb',
    board: ready({ current: ice, following: [movedAway, terminating, cancelled] }),
  },
  {
    id: 'verspaetung',
    name: 'Verspätung mit Ursache',
    board: ready({
      current: regional,
      following: [terminating, cancelled],
      messages: [
        { kind: 'delayCause', code: '43', text: 'Verspätung eines vorausfahrenden Zuges' },
      ],
    }),
  },
  {
    id: 'ausfall',
    name: 'Ausfall',
    board: ready({
      current: cancelled,
      following: [ice],
      messages: [{ kind: 'cancellation', code: '80', text: 'Zug fällt aus' }],
    }),
  },
  {
    id: 'gleiswechsel',
    name: 'Gleiswechsel weg von Gleis 9',
    board: ready({
      current: movedAway,
      following: [ice, terminating],
      messages: [{ kind: 'info', code: '900', text: 'Gleiswechsel' }],
    }),
  },
  {
    id: 'endender-zug',
    name: 'Endender Zug',
    board: ready({ current: terminating, following: [ice] }),
  },
  {
    id: 'langer-name',
    name: 'Langer Ortsname, volle Via-Liste',
    board: ready({ current: longName, following: [ice, regional] }),
  },
  {
    id: 'ersatzzug',
    name: 'Ersatzzug',
    board: ready({ current: replacement, following: [ice, terminating] }),
  },
  { id: 'ohne-zug', name: 'Kein Zug im Zeitraum', board: ready({}) },
  {
    id: 'veraltet',
    name: 'Daten veraltet',
    board: ready({ current: ice, following: [regional], dataAgeSeconds: 184, stale: true }),
  },
  { id: 'laden', name: 'Erster Abruf läuft', board: { state: 'loading' } },
  { id: 'keine-daten', name: 'Quelle antwortet nicht', board: { state: 'unavailable' } },
];
