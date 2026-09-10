import type { BoardEntry } from '@/domain/boardEntry';
import type { StationDetails } from '@/domain/station';

/**
 * Scenarios for development and for the design playground.
 *
 * Times are relative to a reference instant so a fixture stays usable whatever the
 * clock says. Each scenario exists to make one hard case visible: a train that ends
 * here, a platform change, a cancellation, a name too long for the field.
 */

export const mockStations: StationDetails[] = [
  {
    evaNumber: '8000105',
    name: 'Frankfurt(Main)Hbf',
    ds100: 'FF',
    platforms: [
      '1',
      '1a',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
      '21',
      '22',
      '23',
      '24',
    ],
  },
  { evaNumber: '8000207', name: 'Köln Hbf', ds100: 'KK', platforms: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] },
  { evaNumber: '8000760', name: 'Bad Vilbel', ds100: 'FVL', platforms: ['1', '2', '3'] },
];

const minutes = (n: number) => n * 60_000;

/**
 * Builds the standard scenario set for one reference instant.
 *
 * Deliberately not random: the same input always produces the same board, so a
 * screenshot comparison in a later phase means something.
 */
export const mockEntries = (reference: Date): BoardEntry[] => {
  const at = (offsetMinutes: number, delayMinutes = 0) => {
    const planned = new Date(reference.getTime() + minutes(offsetMinutes));
    return { planned, expected: new Date(planned.getTime() + minutes(delayMinutes)) };
  };

  return [
    {
      kind: 'departure',
      id: 'mock-ice-571',
      train: { category: 'ICE', number: '571', operator: '80' },
      platform: { planned: '9', actual: '9', changed: false },
      time: at(4),
      status: 'onTime',
      messages: [],
      destination: { evaNumber: '8000096', name: 'Stuttgart Hbf' },
      via: [
        { evaNumber: '8000150', name: 'Frankfurt(M) Flughafen Fernbf' },
        { evaNumber: '8000244', name: 'Mannheim Hbf' },
      ],
      origin: { evaNumber: '8002549', name: 'Hamburg-Altona' },
    },
    {
      // Delay with a resolved cause: material for the scrolling line.
      kind: 'departure',
      id: 'mock-re-4168',
      train: { category: 'RE', number: '4168', line: 'RE60', operator: '80' },
      platform: { planned: '12', actual: '12', changed: false },
      time: at(9, 12),
      status: 'delayed',
      messages: [
        { kind: 'delayCause', code: '43', text: 'Verspätung eines vorausfahrenden Zuges', priority: 2 },
      ],
      destination: { evaNumber: '8000236', name: 'Frankfurt(Main)Hbf tief' },
      via: [{ evaNumber: '8000244', name: 'Mannheim Hbf' }],
    },
    {
      // Platform change: the display has to mark it, and a platform filter must react.
      kind: 'departure',
      id: 'mock-ic-2310',
      train: { category: 'IC', number: '2310', operator: '80' },
      platform: { planned: '7', actual: '9', changed: true },
      time: at(14, 5),
      status: 'delayed',
      messages: [{ kind: 'info', code: '900', text: 'Gleiswechsel' }],
      destination: { evaNumber: '8000152', name: 'Hannover Hbf' },
      via: [{ evaNumber: '8000149', name: 'Fulda' }, { evaNumber: '8000191', name: 'Kassel-Wilhelmshöhe' }],
    },
    {
      // Ends here (ADR-0003): origin instead of destination, no via stops.
      kind: 'terminatingArrival',
      id: 'mock-rb-15645',
      train: { category: 'RB', number: '15645', line: 'RB61', operator: '80' },
      platform: { planned: '9', actual: '9', changed: false },
      time: at(17, 2),
      status: 'delayed',
      messages: [],
      origin: { evaNumber: '8000770', name: 'Dieburg' },
    },
    {
      // Cancelled: still listed, marked as not running.
      kind: 'departure',
      id: 'mock-rb-15702',
      train: { category: 'RB', number: '15702', line: 'RB58', operator: '80' },
      platform: { planned: '9', actual: '9', changed: false },
      time: at(22),
      status: 'cancelled',
      messages: [{ kind: 'cancellation', code: '80', text: 'Zug fällt aus' }],
      destination: { evaNumber: '8000031', name: 'Bamberg' },
      via: [],
    },
    {
      // Long name plus an unresolved cause code: tests truncation and the rule that an
      // unknown code renders as nothing rather than as a number.
      kind: 'departure',
      id: 'mock-ice-1006',
      train: { category: 'ICE', number: '1006', operator: '80' },
      platform: { planned: '9', actual: '9', changed: false },
      time: at(28, 3),
      status: 'delayed',
      messages: [{ kind: 'delayCause', code: '9999', priority: 3 }],
      destination: { evaNumber: '8010085', name: 'Berlin Gesundbrunnen' },
      via: [
        { evaNumber: '8000191', name: 'Kassel-Wilhelmshöhe' },
        { evaNumber: '8000036', name: 'Braunschweig Hbf' },
        { evaNumber: '8010224', name: 'Berlin Südkreuz' },
      ],
    },
  ];
};
