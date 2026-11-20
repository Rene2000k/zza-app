/**
 * Wagenreihung: the coach sequence the Wagenstandsanzeiger shows.
 *
 * Wagenreihungen come from a source of their own (ADR-0015). Without one the formation is
 * absent, and the display shows its defined idle state.
 */

export type CoachClass = 'first' | 'second' | 'mixed' | 'none';

export interface Coach {
  /** Coach number as printed on the car, e.g. "24". Absent on unnumbered units. */
  readonly number?: string;
  readonly travelClass: CoachClass;
  /**
   * Bahnsteigabschnitt the coach stops in, e.g. "C" — the only statement of where it stands;
   * the Bahnsteigabschnitte a train occupies are derived from its coaches.
   */
  readonly section?: string;
  /** Length in metres, for placing the train on a platform. */
  readonly lengthMetres: number;
  /** Features the display draws as pictograms. */
  readonly features: readonly CoachFeature[];
}

export type CoachFeature =
  | 'bicycles'
  | 'wheelchair'
  | 'dining'
  | 'bistro'
  | 'familyZone'
  | 'quietZone'
  | 'locomotive'
  | 'controlCar';

export interface TrainFormation {
  /** Coaches in the order they stand at the platform, Zugspitze first. */
  readonly coaches: readonly Coach[];
  /** Whether the data describes today's train or only the timetabled formation. */
  readonly accuracy: 'actual' | 'scheduled';
}

/** Whether every coach has a Bahnsteigabschnitt, so the train stands against the ruler. */
export const isPlaced = (formation: TrainFormation): boolean =>
  formation.coaches.every((coach) => coach.section !== undefined);

/**
 * The platform a train is placed on when its source gives no Bahnsteigabschnitte.
 *
 * PoC placeholder: every platform is taken as 400 m with six equal Bahnsteigabschnitte and the
 * train stopping centred. Real per-station platform geometry and stop positions would replace
 * this; until then the placement is only plausible, not right.
 */
const GENERIC_PLATFORM = { lengthMetres: 400, sections: 'ABCDEF' } as const;

/**
 * Gives every coach a Bahnsteigabschnitt. A Wagenreihung whose coaches all have one is returned
 * unchanged — the source wins. Otherwise every coach is placed anew, so that one strip never
 * mixes letters of two origins: on the generic platform, centred, Zugspitze at the A end, each
 * coach in the Bahnsteigabschnitt its middle stands in.
 */
export const withSections = (formation: TrainFormation): TrainFormation => {
  if (isPlaced(formation)) return formation;

  const { lengthMetres: platformLength, sections } = GENERIC_PLATFORM;
  const trainLength = formation.coaches.reduce((sum, coach) => sum + coach.lengthMetres, 0);
  let coachStart = (platformLength - trainLength) / 2;
  const coaches = formation.coaches.map((coach) => {
    const middle = coachStart + coach.lengthMetres / 2;
    coachStart += coach.lengthMetres;
    // A train longer than the platform overhangs it; its end coaches count to the end sections.
    const index = Math.min(
      sections.length - 1,
      Math.max(0, Math.floor((middle * sections.length) / platformLength)),
    );
    return { ...coach, section: sections.charAt(index) };
  });
  return { ...formation, coaches };
};
