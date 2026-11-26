import type { Coach, CoachClass, CoachFeature } from '@/domain/formation';

/** One entry of the directory's list view: one train number in one variant. */
export interface DirectoryEntry {
  readonly category: string;
  readonly number: string;
  /** The stations the variant starts and ends at, as the directory spells them. */
  readonly origin: string;
  readonly destination: string;
  /** Coach 1 first, as the directory lists them. */
  readonly coaches: readonly Coach[];
  readonly validity: Validity;
  /**
   * The route between Richtungswechsel stations, in travel order; a single segment for a train
   * that never reverses. Empty when the entry's direction block cannot be read.
   */
  readonly segments: readonly Segment[];
}

/** A stretch of the route the train runs in one direction. */
export interface Segment {
  /** The station the segment ends at: a Richtungswechsel station, or the destination. */
  readonly to: string;
  /** Which coach of the directory's order is the Zugspitze on this segment. */
  readonly front: 'first' | 'last';
}

/** When a variant runs, as its validity line states it. */
export interface Validity {
  /** First and last day, `YYYY-MM-DD`, both inclusive. */
  readonly from: string;
  readonly to: string;
  /** The operating days, as `Date.getUTCDay()` numbers them: 0 is Sunday. */
  readonly weekdays: ReadonlySet<number>;
}

/**
 * Reads the entries of a saved Reihungsverzeichnis page (the list view of the directory).
 *
 * Parsed with the runtime's DOMParser, as for IRIS (ADR-0007). DOMParser never throws on HTML;
 * a page that is not a directory page simply has no entries. Entries whose train or validity
 * cannot be read are skipped rather than guessed.
 */
export const parseDirectory = (html: string): DirectoryEntry[] => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const year = timetableYearOf(doc);
  return [...doc.querySelectorAll('.reihungsverzeichnis-eintrag')].flatMap((entry) => {
    const train = trainOf(entry);
    const validity = validityOf(entry.querySelector('.zugname'), year);
    if (train === undefined || validity === undefined) return [];
    const lengthMetres = coachLength(textOf(entry.querySelector('.tfz')));
    const featuresByNumber = coachInfos(entry);
    const coaches = [...entry.querySelectorAll('.wagenreihung .wagen')].map((element) =>
      coachOf(element, lengthMetres, featuresByNumber),
    );
    // "Musterstadt Hbf — Beispielburg"
    const [origin = '', destination = ''] = textOf(entry.querySelector('.vonbis'))
      .split('—')
      .map((station) => station.trim());
    const segments = segmentsOf(entry.querySelector('.richtungswechsel'));
    return [{ ...train, origin, destination, coaches, validity, segments }];
  });
};

const ARROWS: Readonly<Record<string, Segment['front']>> = {
  'Pfeil Links': 'first',
  'Pfeil Rechts': 'last',
};

/**
 * The direction block, one segment per line: "← Musterstadt Hbf – Wendeburg", then
 * "Wendeburg – Beispielburg →". A left arrow means coach 1 is the Zugspitze, a right arrow the
 * last coach. A line without exactly one known arrow or without its end station makes the whole
 * block unreadable, and gives no segments at all rather than a partial route.
 */
const segmentsOf = (block: Element | null): Segment[] => {
  const lines = linesOf(block).filter((line) => line.some((node) => !isBlank(node)));
  const segments = lines.map(segmentOf);
  return segments.every((segment) => segment !== undefined) ? segments : [];
};

/** The block's child nodes, split at each `<br>`. */
const linesOf = (block: Element | null): Node[][] => {
  const lines: Node[][] = [[]];
  for (const node of block?.childNodes ?? []) {
    if (node instanceof Element && node.tagName === 'BR') lines.push([]);
    else lines.at(-1)?.push(node);
  }
  return lines;
};

const isBlank = (node: Node): boolean =>
  !(node instanceof Element) && (node.textContent ?? '').trim() === '';

const segmentOf = (line: readonly Node[]): Segment | undefined => {
  const arrows = line.filter((node) => node instanceof Element && node.tagName === 'IMG');
  const front =
    arrows.length === 1 && arrows[0] instanceof Element
      ? ARROWS[arrows[0].getAttribute('alt') ?? '']
      : undefined;
  const stations = line.map((node) => node.textContent ?? '').join('');
  const to = stations.split('–').at(1)?.trim() ?? '';
  return front === undefined || to === '' ? undefined : { to, front };
};

/**
 * The timetable year the page lists, as selected in its search form, with its first and last
 * day. A timetable year runs from the second Sunday in December of the year before up to the
 * Saturday before the second Sunday in December of its own year.
 */
const timetableYearOf = (doc: Document): Partial<Pick<Validity, 'from' | 'to'>> => {
  const selected = doc.querySelector('select[name="fahrplan_jahr"] option[selected]');
  const year = Number(selected?.getAttribute('value'));
  // The form also offers a "Deutschlandtakt" pseudo-year, 9999.
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return {};
  return {
    from: isoDay(secondSundayOfDecember(year - 1)),
    to: isoDay(new Date(secondSundayOfDecember(year).getTime() - DAY_MS)),
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

const secondSundayOfDecember = (year: number): Date => {
  const weekdayOfFirst = new Date(Date.UTC(year, 11, 1)).getUTCDay();
  return new Date(Date.UTC(year, 11, 1 + ((7 - weekdayOfFirst) % 7) + 7));
};

const isoDay = (day: Date): string => day.toISOString().slice(0, 10);

/**
 * The first clause of the line under an entry: "Reihung gültig tgl 14.06.2026 bis 12.12.2026;
 * Zug kommt als …". The dates are read from the `<time>` elements' machine-readable values. An
 * open start or end — or no validity line at all — reaches to the edge of the timetable year;
 * without a known timetable year such an entry has no validity that can be read. No validity
 * line also means every day; operating days stated in any way other than `weekdaysOf` reads make
 * the validity unreadable — they never count as daily.
 */
const validityOf = (
  line: Element | null,
  year: Partial<Pick<Validity, 'from' | 'to'>>,
): Validity | undefined => {
  // The line's text, each date replaced by its machine-readable value as "@YYYY-MM-DD".
  const text = [...(line?.childNodes ?? [])]
    .map((node) => {
      if (!(node instanceof Element)) return node.textContent ?? '';
      if (node.tagName === 'TIME') return ` @${node.getAttribute('datetime') ?? ''} `;
      return node.classList.contains('reihungsverzeichnis-eintrag-zug-link')
        ? ''
        : (node.textContent ?? '');
    })
    .join('')
    .replace(/\s+/g, ' ');
  const clause = /Reihung gültig ([^;]*)/.exec(text)?.[1]?.trim();
  const period = /(?:@(\S+) bis @(\S+)|ab @(\S+)|bis @(\S+))$/.exec(clause ?? '');
  const from = period?.[1] ?? period?.[3] ?? year.from;
  const to = period?.[2] ?? period?.[4] ?? year.to;
  const weekdays =
    clause === undefined
      ? EVERY_DAY
      : weekdaysOf(clause.slice(0, period?.index ?? clause.length).trim());
  if (from === undefined || to === undefined || weekdays === undefined) return undefined;
  return { from, to, weekdays };
};

/** The directory's weekday abbreviations, at the numbers `Date.getUTCDay()` gives the days. */
const WEEK: readonly string[] = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const EVERY_DAY: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6]);

/**
 * "tgl", or a list of days and ranges: "Mo-Fr, So", "Fr, Sa". Anything else is not understood
 * and gives undefined.
 */
const weekdaysOf = (text: string): ReadonlySet<number> | undefined => {
  if (text === 'tgl') return EVERY_DAY;
  const weekdays = new Set<number>();
  for (const item of text.split(',').map((part) => part.trim())) {
    const [first, last = first, ...rest] = item.split('-').map((day) => WEEK.indexOf(day));
    if (first === undefined || first === -1 || last === -1 || rest.length > 0) return undefined;
    // A range runs forward through the week: "Mo-So" is all of it, "Fr-Mo" wraps over Sunday.
    for (let day = first; ; day = (day + 1) % 7) {
      weekdays.add(day);
      if (day === last) break;
    }
  }
  return weekdays;
};

const textOf = (element: Element | null): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * The category from the entry's `gattung_ice` class — the line itself shows some categories as
 * a logo, not as text ("ICE 600", but an EuroCity logo before "1219") — and the number as the
 * line's last word.
 */
const trainOf = (entry: Element) => {
  const gattung = [...entry.classList].find((name) => name.startsWith('gattung_'));
  const category = gattung?.slice('gattung_'.length).toUpperCase() ?? '';
  const number = textOf(entry.querySelector('.zugnr')).split(' ').at(-1) ?? '';
  if (category === '' || number === '') return undefined;
  return { category, number };
};

const coachOf = (
  element: Element,
  lengthMetres: number,
  featuresByNumber: ReadonlyMap<string, readonly CoachFeature[]>,
): Coach => {
  const number = textOf(element.querySelector('.wagen-nummer'));
  // "1. Klasse / 2. Klasse (Sitzplan aufrufen)": the uses of the coach, '/'-separated.
  const uses = (element.querySelector('.wagen-design')?.getAttribute('title') ?? '')
    .replace('(Sitzplan aufrufen)', '')
    .split('/')
    .map((use) => use.trim());
  const usesSet = new Set(uses);
  // A locomotive and a power car are both titled "Lok/Triebkopf"; the type code names the power
  // car ("Triebkopf"). Otherwise the UIC type code ("Bpmdzf") marks a coach with a driver's cab
  // by its letter "f" — but neither of the two is a control car, even where it has an "f".
  const typeCode = textOf(element.querySelector('.wagen-gattung'));
  const powerUnit = usesSet.has('Lok');
  const powerCar = powerUnit && typeCode === 'Triebkopf';
  const controlCar = !powerUnit && typeCode.includes('f');
  const features: CoachFeature[] = [
    ...(usesSet.has('Restaurant') ? (['dining'] as const) : []),
    ...(powerUnit && !powerCar ? (['locomotive'] as const) : []),
    ...(powerCar ? (['powerCar'] as const) : []),
    ...(controlCar ? (['controlCar'] as const) : []),
    ...(featuresByNumber.get(number) ?? []),
  ];
  return {
    ...(number === '' ? {} : { number }),
    travelClass: classOf(usesSet.has('1. Klasse'), usesSet.has('2. Klasse')),
    lengthMetres,
    features,
  };
};

const classOf = (first: boolean, second: boolean): CoachClass => {
  if (first && second) return 'mixed';
  if (first) return 'first';
  if (second) return 'second';
  return 'none';
};

/** The directory's feature lines, by the coach numbers they name. Lines without a feature here are dropped. */
const infoFeatures: Readonly<Record<string, CoachFeature>> = {
  'Kleinkindabteil:': 'familyZone',
  'Rollstuhlstellplätze:': 'wheelchair',
  'Fahrradstellplätze:': 'bicycles',
};

/** "Rollstuhlstellplätze: 9" or "…: 1, 9, 10" — features by coach number. */
const coachInfos = (entry: Element): Map<string, CoachFeature[]> => {
  const byNumber = new Map<string, CoachFeature[]>();
  for (const line of entry.querySelectorAll('.wageninfos > span')) {
    const label = textOf(line.querySelector('strong'));
    const feature = infoFeatures[label];
    if (feature === undefined) continue;
    const numbers = textOf(line).slice(label.length).split(',');
    for (const number of numbers.map((part) => part.trim()).filter((part) => part !== '')) {
      byNumber.set(number, [...(byNumber.get(number) ?? []), feature]);
    }
  }
  return byNumber;
};

/**
 * Average coach length per train type, as the directory names the type: the length of one unit
 * divided by its coaches. A double unit is listed under the same type, so the average fits it too.
 * All coaches of one train get the same length.
 */
const coachLengthByType: Readonly<Record<string, number>> = {
  'ICE 1 (9)': 237.6 / 9,
  'ICE 2': 184.8 / 7,
  'ICE-T': 184.85 / 7,
  'ICE 3': 200.325 / 8,
  'ICE 3 Velaro D': 196.6 / 8,
  'ICE 3 neo': 200.72 / 8,
  'ICE 4 (7)': 201.97 / 7,
  'ICE 4 (12)': 345.72 / 12,
  'ICE 4 (13)': 374.47 / 13,
};

/** The standard UIC coach length, for every type not in the table. */
const DEFAULT_COACH_LENGTH_METRES = 26.4;

const coachLength = (type: string): number =>
  coachLengthByType[type] ?? DEFAULT_COACH_LENGTH_METRES;
