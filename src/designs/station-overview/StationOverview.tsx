import '@fontsource/roboto-condensed/latin-400.css';
import '@fontsource/roboto-condensed/latin-ext-400.css';
import '@fontsource/roboto-condensed/latin-700.css';
import '@fontsource/roboto-condensed/latin-ext-700.css';
import '@fontsource/roboto-condensed/latin-700-italic.css';
import '@fontsource/roboto-condensed/latin-ext-700-italic.css';
import { Fragment } from 'react';
import { FittedText, Marquee, Pictogram, Ticker, formatClockTime } from '@/components/zza';
import { delayMinutes } from '@/domain/boardEntry';
import { splitStop } from '@/domain/coupling';
import { displayableMessages } from '@/domain/message';
import { serviceClass, trainLabel } from '@/domain/train';
import { selectViaStops } from '@/domain/via';
import { useBlink } from '@/hooks/useBlink';
import styles from './station-overview.module.css';
import type { BoardEntry, DepartureEntry } from '@/domain/boardEntry';
import type { BoardMessage, PlainMessageKind } from '@/domain/message';
import type { RouteChange } from '@/domain/routeChange';
import type { RouteStop } from '@/domain/station';
import type { ZzaBoardViewModel } from '@/hooks/useZzaBoard';

export interface StationOverviewProps {
  readonly board: ZzaBoardViewModel;
}

/**
 * The station-wide departure board of the LCD generation: one screen for every train of the
 * station, one line per train, in time order.
 *
 * A header carries the clock and "Abfahrt Departure"; below it, columns for the planned and
 * the expected time, the train, its via stops, its destination and its platform. A blinking dot
 * before the time marks a train about to leave. Each train carries a pictogram of its kind and
 * stands in a box coloured by it: white for long-distance, grey-blue for regional trains and
 * green for the S-Bahn. The two parts of a coupled train stand on consecutive
 * lines, joined by a bracket, the time on the first only. Positions are derived from photographs
 * of the original (layout.md).
 */
export const StationOverview = ({ board }: StationOverviewProps) => {
  const ready = board.state === 'ready' ? board : undefined;
  const banner = dataNotices(board);
  const rowCount = banner.length === 0 ? ROWS : ROWS - 1;
  // A departure board: a train that ends here does not leave, so it is not listed.
  const entries = (ready?.entries ?? []).filter(isDeparture).slice(0, rowCount);
  // One phase for the whole board, so all dots blink together.
  const dotsLit = useBlink(DOT_BLINK_MS);

  return (
    <div className={styles.display}>
      {ready === undefined ? null : (
        <div className={styles.clock}>
          <span className={styles.clockFace}>
            <Pictogram id="clock" />
          </span>
          {formatClockTime(ready.now)}
        </div>
      )}
      <div className={styles.title}>
        <span className={styles.titleGerman}>Abfahrt</span>{' '}
        <span className={styles.titleEnglish}>Departure</span>
      </div>
      <ColumnLabels />
      {entries.map((entry, index) => (
        <Row
          key={entry.id}
          index={index}
          entry={entry}
          previous={entries[index - 1]}
          next={entries[index + 1]}
          now={ready?.now}
          dotLit={dotsLit}
        />
      ))}
      {banner.length === 0 ? null : (
        <div className={styles.banner}>
          <Ticker messages={banner} separator={RUNNING_SEPARATOR} speed={RUNNING_SPEED} />
        </div>
      )}
    </div>
  );
};

/** Lines below the header — twelve, as on the photograph of a single panel. */
const ROWS = 12;

/** Via stops on a line; the photographs show two to four, squeezed where they need it. */
const VIA_STOPS = 4;

/**
 * When the dots before the time appear: hollow from five minutes before the expected departure,
 * filled from three. Assumed, not observed — the photographs show the dots, not when they
 * change.
 */
const HOLLOW_DOT_MINUTES = 5;
const FILLED_DOT_MINUTES = 3;

/** The dots blink, on and off once a second — estimated, as the photographs are stills. */
const DOT_BLINK_MS = 500;

const RUNNING_SEPARATOR = ' +++ ';

/** Canvas pixels per second — estimated, as for V3 and V4. */
const RUNNING_SPEED = 160;

/** Each column names itself in German above English, as on the original. */
const ColumnLabels = () => (
  <>
    {LABELS.map(({ className, german, english }) => (
      <div key={german} className={className}>
        <span>{german}</span>
        <span className={styles.labelEnglish}>{english}</span>
      </div>
    ))}
    <div className={styles.labelRules} />
  </>
);

const LABELS = [
  { className: styles.labelPlanned, german: 'Geplant', english: 'Planned' },
  { className: styles.labelExpected, german: 'Erwartet', english: 'Expected' },
  { className: styles.labelTrain, german: 'Zug', english: 'Train' },
  { className: styles.labelVia, german: 'Über', english: 'Via' },
  { className: styles.labelDestination, german: 'Ziel', english: 'Destination' },
  { className: styles.labelPlatform, german: 'Gleis', english: 'Platform' },
];

/**
 * One train. The second part of a coupled train — the line right after its first part — has
 * neither time nor dot: both leave together, and the bracket says so.
 */
const Row = ({
  index,
  entry,
  previous,
  next,
  now,
  dotLit,
}: {
  readonly index: number;
  readonly entry: DepartureEntry;
  readonly previous: DepartureEntry | undefined;
  readonly next: DepartureEntry | undefined;
  readonly now: Date | undefined;
  /** The blink phase of the dots. */
  readonly dotLit: boolean;
}) => {
  const secondPart = isCoupled(previous, entry);
  const firstPart = isCoupled(entry, next);
  const dot = secondPart || now === undefined ? undefined : departureDot(entry, now);
  const partner = firstPart ? next : secondPart ? previous : undefined;
  const hints = rowHints(entry);
  const service = serviceClass(entry.train);

  return (
    <div className={styles.row} style={{ top: `${ROW_TOP + index * ROW_HEIGHT}px` }}>
      {dot === undefined ? null : (
        <div className={styles.dot} data-filled={dot === 'filled'} data-lit={dotLit} />
      )}
      {secondPart ? null : (
        <>
          <div className={styles.planned}>{formatClockTime(entry.time.planned)}</div>
          <ExpectedTime entry={entry} />
        </>
      )}
      <div className={styles.service}>
        <Pictogram id={service === 'suburban' ? 'sBahn' : 'train'} />
      </div>
      {firstPart ? <div className={styles.bracket} aria-hidden="true" /> : null}
      <div className={styles.train}>
        <FittedText>
          <span className={styles.trainTag} data-service={service}>
            {trainLabel(entry.train)}
          </span>
        </FittedText>
      </div>
      {hints.length > 0 ? (
        <div className={styles.notice} data-inverted="true">
          <Marquee speed={RUNNING_SPEED} closing={RUNNING_SEPARATOR.trimEnd()} gap=" ">
            {hints.map((message) => message.text).join(RUNNING_SEPARATOR)}
          </Marquee>
        </div>
      ) : (
        <div className={styles.via}>
          <ViaStops entry={entry} partner={partner} />
        </div>
      )}
      <div className={styles.destination}>
        <FittedText>{entry.destination.name}</FittedText>
      </div>
      <Platform entry={entry} />
      {/* Below a first part, only the columns that differ between the parts are ruled off. */}
      <div className={firstPart ? styles.rulesJoined : styles.rules} />
    </div>
  );
};

/** Matches `.row` and `.labelRules` in the stylesheet. */
const ROW_TOP = 180;
const ROW_HEIGHT = 75;

/** Inverted beside the planned time from the first full minute of delay, as on V4. */
const ExpectedTime = ({ entry }: { readonly entry: BoardEntry }) =>
  entry.status === 'cancelled' || delayMinutes(entry.time) <= 0 ? null : (
    <div className={styles.expected} data-inverted="true">
      {formatClockTime(entry.time.expected)}
    </div>
  );

/** A changed platform is inverted, so a traveller who knows the usual one notices. */
const Platform = ({ entry }: { readonly entry: BoardEntry }) => {
  const { actual, planned, changed } = entry.platform;
  const label = actual ?? planned;
  if (label === undefined) return null;
  return (
    <div className={styles.platform}>
      <span className={styles.platformLabel} data-inverted={changed}>
        {label}
      </span>
    </div>
  );
};

/**
 * The next via stops on one line, squeezed where they need it. A coupled train marks where its
 * parts are split, right after that stop — or at the end of the line when the split lies
 * beyond the stops shown.
 */
const ViaStops = ({
  entry,
  partner,
}: {
  readonly entry: DepartureEntry;
  readonly partner: DepartureEntry | undefined;
}) => {
  const stops = selectViaStops(entry.via, VIA_STOPS).stops;
  const split = splitAt(entry, partner);
  const splitShown = stops.some((stop) => stop.name === split?.name);
  const splitMark = (
    <span className={styles.letterPictogram}>
      {' '}
      <Pictogram id="trainSplit" />
    </span>
  );
  return (
    <FittedText>
      {stops.map((stop, index) => (
        <Fragment key={stop.name}>
          {index > 0 ? ' – ' : null}
          {stop.name}
          {stop.name === split?.name ? splitMark : null}
        </Fragment>
      ))}
      {split !== undefined && !splitShown ? splitMark : null}
    </FittedText>
  );
};

const isDeparture = (entry: BoardEntry): entry is DepartureEntry => entry.kind === 'departure';

/** The second entry is the part the first one runs coupled with, on the line below it. */
const isCoupled = (first: BoardEntry | undefined, second: BoardEntry | undefined): boolean =>
  first !== undefined && second !== undefined && (first.coupledWith?.includes(second.id) ?? false);

/** Where two coupled parts are split — nowhere, when one of them does not run. */
const splitAt = (entry: BoardEntry, partner: BoardEntry | undefined): RouteStop | undefined =>
  partner === undefined || entry.status === 'cancelled' || partner.status === 'cancelled'
    ? undefined
    : splitStop(entry, partner);

/**
 * The dot of a train about to leave — measured against the expected departure, since that is
 * when it goes. A cancelled train never will.
 */
const departureDot = (entry: DepartureEntry, now: Date): 'hollow' | 'filled' | undefined => {
  if (entry.status === 'cancelled') return undefined;
  const minutesLeft = (entry.time.expected.getTime() - now.getTime()) / 60_000;
  if (minutesLeft <= FILLED_DOT_MINUTES) return 'filled';
  return minutesLeft <= HOLLOW_DOT_MINUTES ? 'hollow' : undefined;
};

/**
 * What takes the place of the via stops, inverted: that the train does not run, and how its
 * route differs today — as the photographs show "Ohne Halt in Köln Hbf". Delays have the
 * expected-time box and a changed platform its inverted field, so neither is worded; the other
 * notices of a single train are left to the platform displays.
 */
const rowHints = (entry: DepartureEntry): readonly BoardMessage[] =>
  displayableMessages([...statusNotices(entry), ...routeNotices(entry)]);

/** A cancellation the source already words is not announced a second time. */
const statusNotices = (entry: BoardEntry): BoardMessage[] => {
  if (entry.status === 'replacement') return [notice('Ersatzzug')];
  if (entry.status !== 'cancelled') return [];
  const worded = displayableMessages(entry.messages).find(
    (message) => message.kind === 'cancellation',
  );
  return [worded ?? notice('Zug fällt aus', 'cancellation')];
};

const routeNotices = (entry: DepartureEntry): BoardMessage[] => {
  if (entry.status === 'cancelled') return [];
  return entry.routeChanges.map((change) => notice(routeText(change, entry.destination.name)));
};

const routeText = (change: RouteChange, destinationName: string): string => {
  if (change.kind === 'endsEarly') return `Heute nur bis ${destinationName}`;
  const stops = change.stops.map((stop) => stop.name).join(', ');
  return change.kind === 'skippedStops' ? `Ohne Halt in ${stops}` : `Zusätzlicher Halt in ${stops}`;
};

/** Notices about the data itself, in a band across the bottom; the original shows none. */
const dataNotices = (board: ZzaBoardViewModel): readonly BoardMessage[] => {
  if (board.state === 'loading') return [];
  if (board.state === 'unavailable') return [notice('Derzeit keine Zugdaten')];
  return board.stale ? [notice('Daten nicht aktuell')] : [];
};

const notice = (text: string, kind: PlainMessageKind = 'info'): BoardMessage => ({ kind, text });
