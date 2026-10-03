export type PictogramId =
  /** A train calling at stops the timetable does not have. */
  | 'haltPlus'
  /** A train leaving out stops of its timetable. */
  | 'haltMinus'
  /** A train leaving from another platform than the one the display stands at. */
  | 'platformChange'
  /** Where a coupled train is split into its parts. */
  | 'trainSplit';

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
};
