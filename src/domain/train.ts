/**
 * How a train is named on the display.
 *
 * The three parts are kept apart because designs use them differently: some show
 * "ICE 571", some show the line label "RE 60", some show a category pictogram plus
 * the number.
 */
export interface TrainRef {
  /** Product category as printed: "ICE", "IC", "RE", "RB", "S", "NX"… */
  readonly category: string;
  /** Train number without the category, e.g. "571". */
  readonly number: string;
  /** Line label where one exists, e.g. "RE60", "S8". Long-distance trains have none. */
  readonly line?: string;
  /** Operator code from the source; useful for non-DB operators. */
  readonly operator?: string;
}

/** "ICE 571" — the plainest rendering, for fallbacks and debug views. */
export const formatTrainRef = (train: TrainRef): string =>
  `${train.category} ${train.number}`.trim();

/**
 * The kind of service a train belongs to, as far as a display tells them apart: long-distance,
 * regional, or a suburban S-Bahn.
 */
export type ServiceClass = 'longDistance' | 'regional' | 'suburban';

/** Categories of long-distance trains, domestic and international, as the sources print them. */
const LONG_DISTANCE: ReadonlySet<string> = new Set([
  'ICE',
  'IC',
  'EC',
  'ECE',
  'EN',
  'NJ',
  'RJ',
  'RJX',
  'FLX',
  'TGV',
  'ES',
  'EST',
  'WB',
  'D',
  'GV',
]);

/**
 * "S5", "S 8": the line label of an S-Bahn. Needed beside the category, because operators run
 * S-Bahns under categories of their own — IRIS gives the Hanover S5 as "SBH". A digit must
 * follow, so a "SE" line is not taken for one.
 */
const S_BAHN_LINE = /^S\s*\d/i;

/** Derived from the category and the line label; anything else counts as regional. */
export const serviceClass = (train: TrainRef): ServiceClass => {
  const category = train.category.trim().toUpperCase();
  if (category === 'S' || S_BAHN_LINE.test(train.line?.trim() ?? '')) return 'suburban';
  return LONG_DISTANCE.has(category) ? 'longDistance' : 'regional';
};
