import { Pictogram } from './Pictogram';
import styles from './zza.module.css';
import { isPlaced } from '@/domain/formation';
import type { Coach, CoachClass, TrainFormation } from '@/domain/formation';

export interface TrainFormationDisplayProps {
  /** Undefined when no source has the Wagenreihung — the normal case. */
  readonly formation: TrainFormation | undefined;
  /**
   * What each coach box prints: its class ("1", "2", "1/2") or its coach number. The design's
   * choice — generations of the display differ in it (ADR-0009).
   */
  readonly coachLabel?: 'class' | 'number';
}

/**
 * Wagenstandsanzeiger: the coaches as equal boxes in a row, Zugspitze first, and above them the
 * letter of each Bahnsteigabschnitt, standing over the coaches that stop in it.
 *
 * It draws only what the model states: the letters are derived from the coaches, so this block
 * neither knows whether a source or the generic-platform fallback set them nor shows a
 * Bahnsteigabschnitt no coach stands in. Coaches without one are drawn without the letters.
 *
 * The shape is drawn here — the boxes, a control car's slanted front at the end its cab faces, a
 * locomotive slanted towards the middle at both ends, and knife and fork in place of a restaurant
 * coach's label. The
 * look is the design's: each coach carries its class (`data-class`) and features
 * (`data-features`) for the design to fill or mark, and a part-first-class coach the end its
 * first-class half is at (`data-first-class-side`), where that can be told. Features are not drawn yet; they need
 * pictograms, not text.
 *
 * Without a formation it shows its defined idle state — an empty coach strip, as real displays
 * do — never an error: the Wagenreihung must not become a hard dependency of the departure
 * display.
 */
export const TrainFormationDisplay = ({
  formation,
  coachLabel = 'class',
}: TrainFormationDisplayProps) => {
  if (formation === undefined) {
    return (
      <div className={styles.formation} data-state="idle" style={{ gridTemplateColumns: '1fr' }}>
        <span className={styles.coach}>{NO_TEXT}</span>
      </div>
    );
  }

  const { coaches } = formation;
  return (
    <div
      className={styles.formation}
      data-state="formation"
      style={{ gridTemplateColumns: `repeat(${coaches.length}, var(--zza-formation-coach, 1fr))` }}
    >
      {isPlaced(formation)
        ? sectionRuns(coaches).map(({ section, start, count }) => (
            <span
              key={`${section}-${start}`}
              className={styles.section}
              style={{ gridColumn: `span ${count}` }}
            >
              {section}
            </span>
          ))
        : null}
      {coaches.map((coach, position) => (
        <span
          // A coach's place in the train is its identity here; unnumbered coaches have nothing
          // else, and a formation is replaced whole, never reordered in place.
          key={coach.number ?? `position-${position}`}
          className={styles.coach}
          data-coach={coach.number ?? ''}
          data-section={coach.section}
          data-class={coach.travelClass}
          data-features={coach.features.join(' ')}
          data-shape={shapeOf(coach, position, coaches.length)}
          data-first-class-side={firstClassSideOf(coaches, position)}
        >
          {edgesOf(shapeOf(coach, position, coaches.length)).map((edge) => (
            <Edge key={edge} edge={edge} />
          ))}
          {coachContent(coach, coachLabel)}
        </span>
      ))}
    </div>
  );
};

/** What a coach box shows: knife and fork for a restaurant, otherwise the design's label. */
const coachContent = (coach: Coach, coachLabel: 'class' | 'number') => {
  if (coach.features.includes('locomotive')) return NO_TEXT;
  if (coach.features.includes('dining')) return <Pictogram id="dining" />;
  if (coachLabel === 'number') return coach.number ?? NO_TEXT;
  return classLabels[coach.travelClass];
};

/** Consecutive coaches in the same Bahnsteigabschnitt, which share one letter above them. */
const sectionRuns = (coaches: readonly Coach[]) =>
  coaches.reduce<{ section: string; start: number; count: number }[]>((runs, coach, position) => {
    const last = runs.at(-1);
    if (last !== undefined && last.section === coach.section) {
      last.count += 1;
    } else {
      runs.push({ section: coach.section ?? '', start: position, count: 1 });
    }
    return runs;
  }, []);

/**
 * A box that is not a plain rectangle: a control car is cut at the end its cab faces, a
 * locomotive is slanted towards the middle at both ends.
 */
type Shape = 'cab-start' | 'cab-end' | 'locomotive';

/**
 * A control car drives from the end of the train it stands at, so one in the front half faces
 * the start, one in the back half the end.
 */
const shapeOf = (coach: Coach, position: number, count: number): Shape | undefined => {
  if (coach.features.includes('locomotive')) return 'locomotive';
  if (!coach.features.includes('controlCar')) return undefined;
  return position < count / 2 ? 'cab-start' : 'cab-end';
};

/**
 * How much of a coach is first class: all of it, part of it (first and second class, or first
 * class and a restaurant), or none.
 */
const firstClassShare = (coach: Coach | undefined): 'whole' | 'part' | 'none' => {
  if (coach?.travelClass === 'mixed') return 'part';
  if (coach?.travelClass !== 'first') return 'none';
  return coach.features.includes('dining') ? 'part' : 'whole';
};

/**
 * Which end a part-first-class coach has its first-class half at: towards the first class next
 * to it, as on the real coaches, where the first-class compartments adjoin. A wholly first-class
 * neighbour counts before a part-first-class one. Undefined where it cannot be told — no first
 * class next to it, or as much on both sides — and for every other coach; the design then draws
 * its default.
 */
const firstClassSideOf = (
  coaches: readonly Coach[],
  position: number,
): 'start' | 'end' | undefined => {
  if (firstClassShare(coaches[position]) !== 'part') return undefined;
  const before = firstClassShare(coaches[position - 1]);
  const after = firstClassShare(coaches[position + 1]);
  for (const share of ['whole', 'part'] as const) {
    if (before === share && after !== share) return 'start';
    if (after === share && before !== share) return 'end';
    if (before === share) return undefined;
  }
  return undefined;
};

/** The slanted edges a shape has, each drawn as a line of its own. */
type EdgeId = 'cab-start' | 'cab-end' | 'nose-start' | 'nose-end';

const edgesOf = (shape: Shape | undefined): EdgeId[] => {
  if (shape === undefined) return [];
  return shape === 'locomotive' ? ['nose-start', 'nose-end'] : [shape];
};

/** Each edge as a line in a unit square, stretched over its part of the box. */
const edgeLines: Record<EdgeId, string> = {
  'cab-start': '0,1 1,0',
  'cab-end': '0,0 1,1',
  'nose-start': '1,0 0,0.5 1,1',
  'nose-end': '0,0 1,0.5 0,1',
};

/**
 * One slanted end: the box itself is cut there (see the CSS), and this draws the cut's edge as a
 * line. The line runs along the cut, so half of it falls outside the box and is clipped away —
 * which is why the CSS gives it twice the stroke.
 */
const Edge = ({ edge }: { readonly edge: EdgeId }) => (
  <svg
    className={styles.edge}
    data-edge={edge}
    aria-hidden="true"
    viewBox="0 0 1 1"
    preserveAspectRatio="none"
  >
    <polyline points={edgeLines[edge]} />
  </svg>
);

/** Keeps an empty box one text line tall without a size literal. */
const NO_TEXT = ' ';

const classLabels: Record<CoachClass, string> = {
  first: '1',
  second: '2',
  mixed: '1/2',
  none: NO_TEXT,
};
