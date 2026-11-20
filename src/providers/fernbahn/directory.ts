import type { Coach, CoachClass, CoachFeature } from '@/domain/formation';

/** One entry of the directory's list view: one train number in one variant. */
export interface DirectoryEntry {
  readonly category: string;
  readonly number: string;
  /** Coach 1 first, as the directory lists them. */
  readonly coaches: readonly Coach[];
}

/**
 * Reads the entries of a saved Reihungsverzeichnis page (the list view of the directory).
 *
 * Parsed with the runtime's DOMParser, as for IRIS (ADR-0007). DOMParser never throws on HTML;
 * a page that is not a directory page simply has no entries. Entries whose train cannot be read
 * are skipped rather than guessed.
 */
export const parseDirectory = (html: string): DirectoryEntry[] => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('.reihungsverzeichnis-eintrag')].flatMap((entry) => {
    const train = trainOf(entry);
    if (train === undefined) return [];
    const lengthMetres = coachLength(textOf(entry.querySelector('.tfz')));
    const featuresByNumber = coachInfos(entry);
    const coaches = [...entry.querySelectorAll('.wagenreihung .wagen')].map((element) =>
      coachOf(element, lengthMetres, featuresByNumber),
    );
    return [{ ...train, coaches }];
  });
};

const textOf = (element: Element | null): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** "ICE 600" — the category is the bold part, the number what follows it. */
const trainOf = (entry: Element) => {
  const category = textOf(entry.querySelector('.zugnr strong'));
  const match = /^(\S+) (\S+)$/.exec(textOf(entry.querySelector('.zugnr')));
  if (category === '' || match?.[1] !== category || match?.[2] === undefined) {
    return undefined;
  }
  return { category, number: match[2] };
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
  // The UIC type code ("Bpmdzf") marks a coach with a driver's cab by its letter "f". A
  // locomotive's own entry ("Triebkopf") is no control car, even where it has an "f".
  const locomotive = usesSet.has('Lok');
  const controlCar = !locomotive && textOf(element.querySelector('.wagen-gattung')).includes('f');
  const features: CoachFeature[] = [
    ...(usesSet.has('Restaurant') ? (['dining'] as const) : []),
    ...(locomotive ? (['locomotive'] as const) : []),
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
