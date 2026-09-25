export type PictogramId =
  /** A train calling at stops the timetable does not have. */
  | 'haltPlus'
  /** A train leaving out stops of its timetable. */
  | 'haltMinus';

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
};
