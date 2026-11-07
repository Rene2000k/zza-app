export type PictogramId =
  /** A train calling at stops the timetable does not have. */
  | 'haltPlus'
  /** A train leaving out stops of its timetable. */
  | 'haltMinus'
  /** A train leaving from another platform than the one the display stands at. */
  | 'platformChange'
  /** Where a coupled train is split into its parts. */
  | 'trainSplit'
  /** The clock face before the time in a station display's header. */
  | 'clock'
  /** A train — every service that is not an S-Bahn — before the train's name. */
  | 'train'
  /** An S-Bahn, before the line's name. */
  | 'sBahn';

export interface PictogramProps {
  readonly id: PictogramId;
}

/**
 * One pictogram of the real displays, redrawn as a vector (ADR-0013).
 *
 * It paints in the colour of its surroundings and is one em tall, so a design sizes and
 * colours it the way it does its text and decides only where it stands. The symbols inside a
 * filled box are cut out rather than painted over, so they show whatever lies behind — the
 * display's surface, as on the original.
 */
export const Pictogram = ({ id }: PictogramProps) => {
  const { label, width, height, path } = drawings[id];
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={`${width / height}em`}
      height="1em"
      fill="currentColor"
      fillRule="evenodd"
    >
      <path d={path} />
    </svg>
  );
};

interface Drawing {
  /** What the symbol says, for anyone who cannot see it. */
  readonly label: string;
  readonly width: number;
  readonly height: number;
  /** Filled with the even-odd rule, so shapes inside the box are holes in it. */
  readonly path: string;
}

const rect = (x: number, y: number, width: number, height: number): string =>
  `M${x} ${y}h${width}v${height}h${-width}Z`;

/**
 * The halt boxes, in dots of a 16-dot tall inverted field: a 10-dot "H" at the bottom left,
 * the sign raised beside it, all in the stroke the display's text has at that size. The plus is drawn as three pieces that do not overlap — under
 * the even-odd rule, overlapping holes would fill in again.
 */
const HALT_BOX = rect(0, 0, 14, 16);
const LETTER_H = [rect(2, 4, 1.2, 10), rect(6.8, 4, 1.2, 10), rect(3.2, 8.4, 3.6, 1.2)].join('');
const MINUS = rect(9, 3.4, 4, 1.2);
const PLUS = [MINUS, rect(10.4, 1.4, 1.2, 2), rect(10.4, 4.6, 1.2, 2)].join('');

/**
 * The track switch that stands before a changed platform: a line running in from the left and
 * turning down to the right, and the branch it leaves behind above. No box — it stands in the
 * line like a letter, in the stroke of the text beside it. The two pieces do not touch.
 */
const SWITCH = 'M0 0H5.6L12 10.4H18V12H11.1L4.7 1.6H0Z' + rect(10, 0, 8, 1.6);

/**
 * The split of a coupled train: the pointed noses of two train parts facing each other, a
 * dotted line between them where the coupling opens. Each nose is a short roof line, a front
 * sloping down towards the coupling and a longer floor line, open to the outside. Like the
 * switch, it stands in the line like a letter.
 */
const NOSE_LEFT = 'M0 0H5.6L9.2 12H0V10.4H7.1L4.5 1.6H0Z';
const NOSE_RIGHT = 'M22 0H16.4L12.8 12H22V10.4H14.9L17.5 1.6H22Z';
const COUPLING = [0, 3.47, 6.93, 10.4].map((y) => rect(10.3, y, 1.4, 1.6));
const SPLIT = [NOSE_LEFT, ...COUPLING, NOSE_RIGHT].join('');

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/**
 * A clock face: a ring and two hands meeting in its centre. The hands touch without
 * overlapping, so neither cuts a hole into the other.
 */
const CLOCK = [
  circle(8, 8, 8),
  circle(8, 8, 6.4),
  rect(7.2, 3.2, 1.6, 5.6),
  rect(8.8, 7.2, 3.6, 1.6),
].join('');

/** The ring around the service pictograms, thinner than the clock's. */
const SERVICE_RING = circle(8, 8, 8) + circle(8, 8, 6.8);

/**
 * The front of a train inside the ring: a body with a rounded roof, a windscreen and two lamps
 * cut out of it, and below it the outline of the coupler skirt. Nothing touches the ring.
 */
const TRAIN_BODY = 'M5 10.2V4.6Q5 2.8 8 2.8Q11 2.8 11 4.6V10.2Z';
const WINDSCREEN = rect(6.2, 4.4, 3.6, 3.2);
const LAMPS = rect(5.8, 8.6, 1, 0.8) + rect(9.2, 8.6, 1, 0.8);
const SKIRT = 'M5.4 10.9H10.6L11.6 13.2H4.4Z' + 'M6 11.7L5.5 12.5H10.5L10 11.7Z';
const TRAIN = [SERVICE_RING, TRAIN_BODY, WINDSCREEN, LAMPS, SKIRT].join('');

/**
 * The S inside the ring, as two thick arcs of 250° each that meet edge to edge in the middle —
 * touching, not overlapping, so the even-odd rule leaves them filled.
 */
const S_UPPER = 'M10.725 4.808A2.9 2.9 0 1 0 8 8.7L8 7.3A1.5 1.5 0 1 1 9.41 5.287Z';
const S_LOWER = 'M8 7.3A2.9 2.9 0 1 1 5.275 11.192L6.59 10.713A1.5 1.5 0 1 0 8 8.7Z';
const S_BAHN = [SERVICE_RING, S_UPPER, S_LOWER].join('');

const drawings: Record<PictogramId, Drawing> = {
  haltPlus: {
    label: 'Zusätzlicher Halt',
    width: 14,
    height: 16,
    path: HALT_BOX + LETTER_H + PLUS,
  },
  haltMinus: {
    label: 'Halt entfällt',
    width: 14,
    height: 16,
    path: HALT_BOX + LETTER_H + MINUS,
  },
  platformChange: {
    label: 'Gleiswechsel',
    width: 18,
    height: 12,
    path: SWITCH,
  },
  trainSplit: {
    label: 'Zugteilung',
    width: 22,
    height: 12,
    path: SPLIT,
  },
  clock: {
    label: 'Uhrzeit',
    width: 16,
    height: 16,
    path: CLOCK,
  },
  train: {
    label: 'Zug',
    width: 16,
    height: 16,
    path: TRAIN,
  },
  sBahn: {
    label: 'S-Bahn',
    width: 16,
    height: 16,
    path: S_BAHN,
  },
};
