import '@fontsource/roboto-condensed/latin-400.css';
import '@fontsource/roboto-condensed/latin-ext-400.css';
import {
  FittedText,
  Pictogram,
  Ticker,
  TrainFormationDisplay,
  formatClockTime,
  formatDelay,
  haltChangePictograms,
} from '@/components/zza';
import { announcedDelayMinutes, headlineStation } from '@/domain/boardEntry';
import { PLATFORM_QUALITY_TOPICS, uniqueMessages } from '@/domain/message';
import { trainLabel } from '@/domain/train';
import { trainNotices } from '@/domain/trainNotices';
import { selectViaStops } from '@/domain/via';
import styles from './v3-5x2.module.css';
import type { BoardEntry } from '@/domain/boardEntry';
import type { BoardMessage, MessageKind, PlainMessageKind } from '@/domain/message';
import type { RouteChange } from '@/domain/routeChange';
import type { TrainNotices } from '@/domain/trainNotices';
import type { ZzaBoardViewModel } from '@/hooks/useZzaBoard';

export interface V3_5x2Props {
  readonly board: ZzaBoardViewModel;
}

/**
 * The V3 platform display assembled from 5 × 2 modules, in its variant with a platform field.
 *
 * Positions are measured dots of the original (layout.md); text is drawn with an outline font
 * instead of a reproduced matrix (ADR-0010). The display has neither colour nor blinking: its
 * only emphasis is inversion, and whatever a notice has to say runs as text in one of three
 * running lines — above the main train, and behind each of the two following trains. That
 * includes the main train's delay, which it words there instead of printing a "+7" field.
 *
 * A coupled main train that is split ahead takes the whole display: its second part fills the
 * lower module row in the upper row's layout, in place of the following trains (ADR-0014).
 */
export const V3_5x2 = ({ board }: V3_5x2Props) => {
  const ready = board.state === 'ready' ? board : undefined;
  const current = ready?.current;
  const secondPart = ready?.secondPart;
  const platform = ready?.platform ?? current?.platform.actual ?? current?.platform.planned;
  const mainNotices =
    current === undefined
      ? undefined
      : trainNotices(current, { platform: ready?.platform, coupledPart: secondPart });

  return (
    <div className={styles.display}>
      {current === undefined || mainNotices === undefined ? null : (
        <MainTrain entry={current} notices={mainNotices} />
      )}
      <RunningLine className={styles.mainHint} messages={mainHints(board, mainNotices)} />
      <div className={styles.platform}>{platform}</div>

      {current === undefined || secondPart === undefined ? (
        <>
          <div className={styles.followingLabel}>Folgezüge:</div>
          {ready?.following.slice(0, FOLLOWING_ROWS).map((entry, row) => (
            <FollowingTrain key={entry.id} entry={entry} row={row} platform={ready?.platform} />
          ))}
        </>
      ) : (
        <SecondPart entry={secondPart} platform={ready?.platform} partner={current} />
      )}

      <div className={styles.seams} aria-hidden="true" />
    </div>
  );
};

/** V3 has exactly two following rows and does not page through further trains. */
const FOLLOWING_ROWS = 2;

/** The next three stops in travel order, as the real display shows them (ADR-0005). */
const VIA_STOPS = 3;

const RUNNING_SEPARATOR = ' +++ ';

/** Canvas pixels per second, about 40 dots of the original — estimated, not measured. */
const RUNNING_SPEED = 105;

/** The announced delay is rounded down to this many minutes. */
const DELAY_STEP = 5;

/**
 * Of the notices the source delivers, only these belong on this display. Delay causes and
 * disruption reports do not run here — the display words the delay itself.
 */
const SHOWN_KINDS: ReadonlySet<MessageKind> = new Set<MessageKind>(['cancellation']);

interface TrainProps {
  readonly entry: BoardEntry;
  readonly notices: TrainNotices;
}

const MainTrain = ({ entry, notices }: TrainProps) => (
  <>
    <div className={styles.time}>{formatClockTime(entry.time.planned)}</div>
    <div className={styles.train}>
      <FittedText>{trainLabel(entry.train)}</FittedText>
      <HaltPictograms notices={notices} />
    </div>
    {/* The real display leaves the area empty without a coach sequence, strip included. */}
    {entry.formation === undefined ? null : (
      <div className={styles.formation}>
        <TrainFormationDisplay formation={entry.formation} />
      </div>
    )}
    <div className={styles.via}>
      <FittedText>{viaText(entry)}</FittedText>
    </div>
    <div className={styles.destination}>
      <FittedText>{headline(entry)}</FittedText>
    </div>
  </>
);

/** The second part of a coupled train, which says the same about itself as the first. */
const SecondPart = ({
  entry,
  platform,
  partner,
}: {
  readonly entry: BoardEntry;
  readonly platform: string | undefined;
  readonly partner: BoardEntry;
}) => {
  const notices = trainNotices(entry, { platform, coupledPart: partner });
  return (
    <div className={styles.secondPart}>
      <MainTrain entry={entry} notices={notices} />
      <RunningLine className={styles.mainHint} messages={trainHints(entry, notices)} />
    </div>
  );
};

const FollowingTrain = ({
  entry,
  row,
  platform,
}: {
  readonly entry: BoardEntry;
  readonly row: number;
  readonly platform: string | undefined;
}) => (
  <div className={row === 0 ? styles.followingFirst : styles.followingSecond}>
    <div className={styles.followingTime}>{formatClockTime(entry.time.planned)}</div>
    <DeviationField className={styles.followingDeviation} entry={entry} />
    <div className={styles.followingTrain}>
      <FittedText>{trainLabel(entry.train)}</FittedText>
    </div>
    <div className={styles.followingDestination}>
      <FittedText>{headline(entry)}</FittedText>
    </div>
    <RunningLine
      className={styles.followingHint}
      messages={followingHints(entry, trainNotices(entry, { platform }))}
    />
  </div>
);

/**
 * H+ and H− beside the main train's name (ADR-0013). No photograph shows them on this
 * generation, so they take the place V4 gives them: right of the train, as tall as its band,
 * which squeezes a long train name rather than covering it. The following rows have no room
 * and carry the change in their running line only. The boxes follow the notice record's route
 * changes, so a cancelled train carries none.
 */
const HaltPictograms = ({ notices }: { readonly notices: TrainNotices }) => {
  const pictograms = haltChangePictograms(notices.routeChanges);
  if (pictograms.length === 0) return null;
  return (
    <div className={styles.pictograms}>
      {pictograms.map((id) => (
        <Pictogram key={id} id={id} />
      ))}
    </div>
  );
};

interface FieldProps {
  readonly className: string | undefined;
}

/**
 * A field without text stays blue: the real display shows no empty white bar. A running line
 * also ends on the separator, so it reads the same when it starts over.
 */
const RunningLine = ({
  className,
  messages,
}: FieldProps & { readonly messages: readonly BoardMessage[] }) => (
  <div className={className} data-inverted={messages.length > 0}>
    <Ticker
      messages={messages}
      separator={RUNNING_SEPARATOR}
      closeWithSeparator
      speed={RUNNING_SPEED}
    />
  </div>
);

/**
 * A following train states its deviation, "+7", never the expected time. A cancelled train
 * has none: its running line says it does not run, and a delay beside that contradicts it.
 */
const DeviationField = ({ className, entry }: FieldProps & { readonly entry: BoardEntry }) => {
  const deviation = formatDelay(announcedDelayMinutes(entry));
  return (
    <div className={className} data-inverted={deviation !== undefined}>
      {deviation}
    </div>
  );
};

/** Where the train goes, or where it came from when it ends here. */
const headline = (entry: BoardEntry): string =>
  entry.kind === 'terminatingArrival'
    ? `von ${headlineStation(entry).name}`
    : headlineStation(entry).name;

/** A train ending here has no stops ahead, and the line tells people to stay off it instead. */
const viaText = (entry: BoardEntry): string =>
  entry.kind === 'departure'
    ? selectViaStops(entry.via, VIA_STOPS)
        .stops.map((stop) => stop.name)
        .join(' - ')
    : 'Bitte nicht einsteigen';

/**
 * The main train's running line. It is also the only place left for a notice about the data
 * itself, which takes the line when no train text runs there.
 */
const mainHints = (
  board: ZzaBoardViewModel,
  notices: TrainNotices | undefined,
): readonly BoardMessage[] => {
  if (board.state === 'loading') return [];
  if (board.state === 'unavailable') return [notice('Derzeit keine Zugdaten')];

  const { current } = board;
  const hints = current === undefined || notices === undefined ? [] : trainHints(current, notices);
  return hints.length === 0 && board.stale ? [notice('Daten nicht aktuell')] : hints;
};

/**
 * What runs above a train in the upper layout: the main train's, or that of the second part
 * of a coupled one, which says the same about itself.
 */
const trainHints = (entry: BoardEntry, notices: TrainNotices): readonly BoardMessage[] =>
  uniqueMessages([
    ...statusNotices(notices, 'Zug fällt aus'),
    ...(entry.kind === 'terminatingArrival' ? [notice('Fahrt endet hier')] : []),
    ...splitNotice(notices),
    ...delayNotice(entry),
    ...routeNotices(entry, notices),
    ...shown(entry.messages),
    ...platformChange(notices),
  ]);

/** "Zug wird in Gießen geteilt", above both parts, as the real displays word it. */
const splitNotice = ({ splitStop }: TrainNotices): BoardMessage[] =>
  splitStop === undefined ? [] : [notice(`Zug wird in ${splitStop.name} geteilt`)];

/** A train that changed away leads the following rows, and its line says so first. */
const followingHints = (entry: BoardEntry, notices: TrainNotices): readonly BoardMessage[] =>
  uniqueMessages([
    ...platformChange(notices),
    ...statusNotices(notices, 'Fällt aus'),
    ...(entry.kind === 'terminatingArrival' ? [notice('Zug endet hier')] : []),
    ...routeNotices(entry, notices),
    ...shown(entry.messages),
  ]);

/**
 * A cancellation is worded in the source's own text where it gives one — that text runs among
 * the source's messages, where the source puts it — and in this display's words otherwise,
 * in this slot. Never both.
 */
const statusNotices = (notices: TrainNotices, cancelledWording: string): BoardMessage[] => {
  if (notices.replacement) return [notice('Ersatzzug')];
  return notices.cancellation !== undefined && notices.cancellation.message === undefined
    ? [notice(cancelledWording, 'cancellation')]
    : [];
};

/**
 * "Verspätung ca. 10 Min.", rounded down to five minutes — which leaves nothing to say below
 * five.
 */
const delayNotice = (entry: BoardEntry): BoardMessage[] => {
  const rounded = Math.floor(announcedDelayMinutes(entry) / DELAY_STEP) * DELAY_STEP;
  return rounded > 0 ? [notice(`Verspätung ca. ${rounded} Min.`)] : [];
};

/**
 * A train that left this display's platform. On a platform display the view model never makes
 * it the main train but puts it at the top of the following rows (ADR-0006), so in practice
 * the main train carries this only on a station-wide display. The platform field keeps
 * showing the platform the display stands at.
 */
const platformChange = ({ movedTo }: TrainNotices): BoardMessage[] =>
  movedTo === undefined ? [] : [notice(`Heute von Gleis ${movedTo}`)];

/**
 * What the display says about a route that differs from the timetable (ADR-0012).
 *
 * The model states the case and the stops; the wording is this design's, after the real V3
 * displays. Every affected station is named, however many there are — that is what the
 * original does, and shortening the list would drop the one name a traveller is waiting for.
 * "Heute nur bis" takes the destination from the entry, which already names where the train
 * really ends.
 */
const routeNotices = (entry: BoardEntry, { routeChanges }: TrainNotices): BoardMessage[] => {
  if (entry.kind !== 'departure') return [];
  return routeChanges.map((change) => notice(routeText(change, entry.destination.name)));
};

const routeText = (change: RouteChange, destinationName: string): string => {
  if (change.kind === 'endsEarly') return `Heute nur bis ${destinationName}`;
  const stops = stopNames(change);
  return change.kind === 'skippedStops'
    ? `Heute ohne Halt in ${stops}`
    : `Heute mit zusätzlichem Halt in ${stops}`;
};

const stopNames = (change: RouteChange): string => change.stops.map((stop) => stop.name).join(', ');

/** A quality notice is picked by its subject, every other message by its kind. */
const shown = (messages: readonly BoardMessage[]): BoardMessage[] =>
  messages.filter((message) =>
    message.kind === 'qualityNotice'
      ? PLATFORM_QUALITY_TOPICS.has(message.topic)
      : SHOWN_KINDS.has(message.kind),
  );

const notice = (text: string, kind: PlainMessageKind = 'info'): BoardMessage => ({ kind, text });
