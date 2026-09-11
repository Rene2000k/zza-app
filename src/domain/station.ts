/** A station as the display needs it: an identity plus the name to put on screen. */
export interface StationRef {
  /** EVA number (IBNR), the stable identifier used for lookups. */
  readonly evaNumber: string;
  /** Name as shown to travellers, e.g. "Frankfurt(Main)Hbf". */
  readonly name: string;
  /** Operational abbreviation (RL100 / DS100), e.g. "FF". Not always known. */
  readonly ds100?: string;
}

/**
 * A stop on a train's route — its destination, origin or a via stop — as the display
 * names it.
 *
 * Unlike a `StationRef` it need not carry an EVA number: sources commonly report a route
 * as names only (IRIS does), and a missing identifier has to stay visibly missing rather
 * than be filled with something that merely looks like one.
 */
export interface RouteStop {
  readonly name: string;
  /** EVA number, only where the source reports one. */
  readonly evaNumber?: string;
}

/** A station with the extra detail only a lookup provides. */
export interface StationDetails extends StationRef {
  /**
   * Platforms the station has, in the order the source reported them.
   * Platform labels are strings on purpose: "9", "1a" and "109" all occur.
   */
  readonly platforms: readonly string[];
}

/**
 * Two platform labels denote the same platform.
 *
 * Labels are not comparable as plain strings: sources write "9", " 9" or "Gl. 9",
 * and a section suffix ("9a") still means platform 9. Comparison is therefore
 * case-insensitive, ignores whitespace and a leading "Gl."/"Gleis", and treats a
 * trailing section letter as part of the platform.
 */
export const isSamePlatform = (a: string | undefined, b: string | undefined): boolean => {
  if (a === undefined || b === undefined) return false;
  return normalisePlatform(a) === normalisePlatform(b);
};

export const normalisePlatform = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    // "gleis" must precede "gl" in the alternation: regex alternation is first-match,
    // so the shorter branch would otherwise consume "gl" and leave "eis".
    .replace(/^(gleis|gl\.?)\s*/, '')
    .replace(/\s+/g, '');
