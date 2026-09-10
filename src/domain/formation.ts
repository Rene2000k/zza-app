/**
 * Coach sequence for the coach-position display.
 *
 * No free data source for this currently works (see ADR-0002), so in practice the
 * formation is absent and the display shows its defined idle state. The model exists
 * anyway, so that a later source needs no change to the layers above.
 */

export type CoachClass = 'first' | 'second' | 'mixed' | 'none';

export interface Coach {
  /** Coach number as printed on the car, e.g. "24". Absent on unnumbered units. */
  readonly number?: string;
  readonly travelClass: CoachClass;
  /** Platform section the coach stops at, e.g. "C". */
  readonly section?: string;
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
  /** Coaches in the order they stand at the platform, front first. */
  readonly coaches: readonly Coach[];
  /** Platform sections this train occupies, e.g. ["B", "C", "D"]. */
  readonly sections: readonly string[];
  /** Whether the data describes today's train or only the timetabled formation. */
  readonly accuracy: 'actual' | 'scheduled';
}
