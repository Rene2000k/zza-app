import '@fontsource/roboto-condensed/latin-400.css';
import '@fontsource/roboto-condensed/latin-ext-400.css';
import { Fragment } from 'react';
import {
  FittedText,
  Marquee,
  Pictogram,
  Ticker,
  TrainFormationDisplay,
  formatClockTime,
  haltChangePictograms,
} from '@/components/zza';
import { announcedDelayMinutes, headlineStation } from '@/domain/boardEntry';
import { PLATFORM_QUALITY_TOPICS, uniqueMessages } from '@/domain/message';
import { trainLabel } from '@/domain/train';
import { trainNotices } from '@/domain/trainNotices';
import { selectViaStops } from '@/domain/via';
import styles from './v4-5x2.module.css';
import type { BoardEntry, DepartureEntry, TerminatingArrivalEntry } from '@/domain/boardEntry';
import type { BoardMessage, MessageKind, PlainMessageKind } from '@/domain/message';
import type { RouteChange } from '@/domain/routeChange';
import type { RouteStop } from '@/domain/station';
import type { TrainNotices } from '@/domain/trainNotices';
import type { ReadyBoard, ZzaBoardViewModel } from '@/hooks/useZzaBoard';
import type { ReactNode } from 'react';

export interface V4_5x2Props {
  readonly board: ZzaBoardViewModel;
}

/**
 * The V4 platform display, the LCD successor of V3 in the same 5 × 2 module housing.
 *
 * V4 drops the platform field and gives the whole width to text. The upper module row
 * carries the main train — train and time on the left, running line, via stops and
 * destination in a text column that starts inside the second module. The lower module row
 * shows the coach sequence above a rule and the following trains below it, each on a single
 * line. Positions are measured from reference renderings and photographs (layout.md); text is
 * drawn with an outline font (ADR-0010).
 *
 * Where V3 words the delay, V4 prints the expected time in an inverted box beside the planned
 * one. A train ending here turns the layout round: the upper row warns people off it, the
 * lower row says so in large type. A coupled train that is split ahead puts its second part
 * into the lower row, joined to the first by a bracket (ADR-0014).
 */
export const V4_5x2 = ({ board }: V4_5x2Props) => {
  const ready = board.state === 'ready' ? board : undefined;
  const current = ready?.current;

  return (
    <div className={styles.display}>
      {current?.kind === 'terminatingArrival' ? (
        <Arrival board={board} entry={current} />
      ) : (
        <Departure board={board} entry={current} />
      )}
      <FollowingTrains board={ready} />
      <div className={styles.seams} aria-hidden="true" />
    </div>
  );
};

/** V4 has room for two following trains, or one while a second part takes the lower row. */
const FOLLOWING_ROWS = 2;

/** Via stops on a single line — when a running line takes the band above it. */
const VIA_STOPS_ONE_LINE = 4;

/** Via stops on two lines — when nothing runs above them and the via list may use the band. */
const VIA_STOPS_TWO_LINES = 6;

const RUNNING_SEPARATOR = ' +++ ';

/** Canvas pixels per second — estimated, as for V3; still images cannot show it. */
const RUNNING_SPEED = 100;

/**
 * The parts of a following train's line stand apart by a wide space, as on the original —
 * non-breaking, since a running line collapses ordinary runs of spaces.
 */
const ROW_GAP = '  ';

/** A second part has no time field, so its delay is worded, rounded down to this many minutes. */
const DELAY_STEP = 5;

/** As V3: of the notices the source delivers, only cancellations run on this display. */
const SHOWN_KINDS: ReadonlySet<MessageKind> = new Set<MessageKind>(['cancellation']);

/**
 * The upper module row for a departing train — or for none, when the display rests. Train
 * notices run above the via line, cut off from it by a rule; a notice about the data takes
 * the inverted band across the full width instead, and only while no train text needs it.
 */
const Departure = ({
  board,
  entry,
}: {
  readonly board: ZzaBoardViewModel;
  readonly entry: DepartureEntry | undefined;
}) => {
  const ready = board.state === 'ready' ? board : undefined;
  const secondPart = ready?.secondPart;
  const notices =
    entry === undefined
      ? undefined
      : trainNotices(entry, { platform: ready?.platform, coupledPart: secondPart });
  const hints =
    entry === undefined || notices === undefined || ready === undefined
      ? []
      : trainHints(entry, notices, ready.messages, { split: true });
  const banner = hints.length === 0 ? dataNotices(board) : [];
  const viaHasBand = hints.length === 0 && banner.length === 0;

  return (
    <>
      <RunningLine className={styles.mainHint} messages={hints} emphasis="ruled" />
      <RunningLine className={styles.banner} messages={banner} emphasis="inverted" />
      {entry === undefined || notices === undefined ? null : (
        <>
          <div className={styles.train}>
            <FittedText>{trainLabel(entry.train)}</FittedText>
          </div>
          <HaltPictograms className={styles.pictograms} notices={notices} />
          <div className={viaHasBand ? styles.viaTwoLines : styles.via}>
            <ViaStops entry={entry} split={notices.splitStop} twoLines={viaHasBand} />
          </div>
          <div className={styles.time}>{formatClockTime(entry.time.planned)}</div>
          <ExpectedTime className={styles.expected} entry={entry} />
          <div className={styles.destination}>
            <FittedText>{headlineStation(entry).name}</FittedText>
          </div>
          {secondPart === undefined ? (
            <Formation entry={entry} />
          ) : (
            <SecondPart entry={secondPart} partner={entry} platform={ready?.platform} />
          )}
          <div className={secondPart === undefined ? styles.rule : styles.ruleLow} />
        </>
      )}
    </>
  );
};

/** The real display leaves the area empty without a coach sequence, strip included. */
const Formation = ({ entry }: { readonly entry: BoardEntry }) =>
  entry.formation === undefined ? null : (
    <div className={styles.formation}>
      <TrainFormationDisplay formation={entry.formation} />
    </div>
  );

/**
 * The second part of a coupled train, in the lower module row: its train, its via stops and
 * its destination, joined to the first part's destination by a bracket. It has no time field —
 * both parts leave together. The split is announced above the first part only; a notice that
 * concerns this part alone takes the place of its via stops, above a rule.
 */
const SecondPart = ({
  entry,
  partner,
  platform,
}: {
  readonly entry: BoardEntry;
  readonly partner: DepartureEntry;
  readonly platform: string | undefined;
}) => {
  const notices = trainNotices(entry, { platform, coupledPart: partner });
  const hints = [
    ...trainHints(entry, notices, entry.messages, { split: false }),
    ...delayNotice(entry),
  ];
  return (
    <>
      <div className={styles.bracket} aria-hidden="true" />
      <div className={styles.secondTrain}>
        <FittedText>{trainLabel(entry.train)}</FittedText>
      </div>
      {hints.length > 0 || entry.kind !== 'departure' ? (
        <RunningLine className={styles.secondHint} messages={hints} emphasis="ruled" />
      ) : (
        <div className={styles.secondVia}>
          <ViaStops entry={entry} split={notices.splitStop} twoLines={false} />
        </div>
      )}
      <div className={styles.secondDestination}>
        <FittedText>{headlineStation(entry).name}</FittedText>
      </div>
    </>
  );
};

/**
 * A train ending here. Train, time and expected time stand where a departure has them; the
 * text column keeps people off the train and names where it came from in small type, and the
 * lower row says in large type that it ends, above the rule to the following trains. Every
 * notice runs inverted across the full width at the top, the data notices included.
 */
const Arrival = ({
  board,
  entry,
}: {
  readonly board: ZzaBoardViewModel;
  readonly entry: TerminatingArrivalEntry;
}) => {
  const ready = board.state === 'ready' ? board : undefined;
  const hints =
    ready === undefined
      ? []
      : arrivalHints(trainNotices(entry, { platform: ready.platform }), ready.messages);
  const banner = hints.length === 0 ? dataNotices(board) : hints;

  return (
    <>
      <RunningLine className={styles.banner} messages={banner} emphasis="inverted" />
      <div className={styles.boardingWarning}>Bitte nicht einsteigen</div>
      <div className={styles.train}>
        <FittedText>{trainLabel(entry.train)}</FittedText>
      </div>
      <div className={styles.arrivalOrigin}>
        <FittedText>{`von ${entry.origin.name}`}</FittedText>
      </div>
      <div className={styles.time}>{formatClockTime(entry.time.planned)}</div>
      <ExpectedTime className={styles.expected} entry={entry} />
      <div className={styles.arrivalHeadline}>Zug endet hier</div>
      <div className={styles.rule} />
    </>
  );
};

/**
 * The following trains, below the rule. A row is a single line — train, destination, the next
 * via stop and whatever it has to say, standing apart by a wide space — that runs when it is
 * too long. A row turns inverted for what a traveller must not miss: the train does not run,
 * or leaves from another platform, which then stands at the right end of the row.
 */
const FollowingTrains = ({ board }: { readonly board: ReadyBoard | undefined }) => {
  if (board === undefined) return null;
  const rows =
    board.secondPart === undefined || board.current?.kind !== 'departure' ? FOLLOWING_ROWS : 1;
  const places = rows === 1 ? [styles.rowLower] : [styles.rowUpper, styles.rowLower];
  return board.following
    .slice(0, rows)
    .map((entry, index) => (
      <FollowingTrain
        key={entry.id}
        className={places[index]}
        entry={entry}
        platform={board.platform}
      />
    ));
};

const FollowingTrain = ({
  className,
  entry,
  platform,
}: {
  readonly className: string | undefined;
  readonly entry: BoardEntry;
  readonly platform: string | undefined;
}) => {
  const notices = trainNotices(entry, { platform });
  const cancelled = notices.cancellation !== undefined;
  const { movedTo } = notices;
  return (
    <div className={className} data-inverted={cancelled || movedTo !== undefined}>
      <div className={styles.followingTime}>
        {cancelled
          ? `× ${formatClockTime(entry.time.planned)}`
          : formatClockTime(entry.time.planned)}
      </div>
      <ExpectedTime className={styles.followingExpected} entry={entry} />
      <div className={styles.followingLine}>
        <Marquee speed={RUNNING_SPEED} closing={RUNNING_SEPARATOR.trimEnd()} gap=" ">
          {followingText(entry, notices)}
        </Marquee>
        <HaltPictograms className={styles.followingPictograms} notices={notices} />
        {movedTo === undefined ? null : (
          <span className={styles.letterPictogram}>
            <Pictogram id="platformChange" /> Gleis {movedTo}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * H+ and H− (ADR-0013), beside the main train's name and at the end of a following row — for
 * the route changes the notices announce, so a cancelled train carries none.
 */
const HaltPictograms = ({
  className,
  notices,
}: {
  readonly className: string | undefined;
  readonly notices: TrainNotices;
}) => {
  const pictograms = haltChangePictograms(notices.routeChanges);
  if (pictograms.length === 0) return null;
  return (
    <div className={className}>
      {pictograms.map((id) => (
        <Pictogram key={id} id={id} />
      ))}
    </div>
  );
};

/**
 * The expected time, inverted beside the planned one — "23:10" where V3 would say
 * "Verspätung ca. 25 Min.". It shows from the first full minute; a cancelled train has none.
 */
const ExpectedTime = ({
  className,
  entry,
}: {
  readonly className: string | undefined;
  readonly entry: BoardEntry;
}) =>
  announcedDelayMinutes(entry) <= 0 ? null : (
    <div className={className} data-inverted="true">
      {formatClockTime(entry.time.expected)}
    </div>
  );

/**
 * The via stops, each kept whole: a line breaks only between two stops, and the separator
 * stays at the end of the line it follows, as on the original. On two lines the list sits on
 * the lower one when it is short enough for one.
 */
const ViaStops = ({
  entry,
  split,
  twoLines,
}: {
  readonly entry: DepartureEntry;
  /** Where a coupled train is split; the stop is marked in the list. */
  readonly split: RouteStop | undefined;
  readonly twoLines: boolean;
}) => {
  const items = viaItems(entry, split, twoLines ? VIA_STOPS_TWO_LINES : VIA_STOPS_ONE_LINE);
  if (!twoLines) {
    return (
      <FittedText>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? ' - ' : null}
            {item.content}
          </Fragment>
        ))}
      </FittedText>
    );
  }
  return (
    <div className={styles.viaLines}>
      {items.map((item, index) =>
        index < items.length - 1 ? (
          // The space after the item is the only place the line may break.
          <Fragment key={item.key}>
            <span className={styles.viaStop}>
              {item.content}
              {' -'}
            </span>{' '}
          </Fragment>
        ) : (
          <span key={item.key} className={styles.viaStop}>
            {item.content}
          </span>
        ),
      )}
    </div>
  );
};

interface ViaItem {
  readonly key: string;
  readonly content: ReactNode;
}

/**
 * The via stops, with the split pictogram as an item of its own right after the stop where a
 * coupled train is split — in both parts' lists, as on the original.
 */
const viaItems = (
  entry: DepartureEntry,
  split: RouteStop | undefined,
  maxStops: number,
): readonly ViaItem[] =>
  selectViaStops(entry.via, maxStops).stops.flatMap((stop) => [
    { key: stop.name, content: stop.name },
    ...(stop.name === split?.name
      ? [
          {
            key: 'split',
            content: (
              <span className={styles.letterPictogram}>
                <Pictogram id="trainSplit" />
              </span>
            ),
          },
        ]
      : []),
  ]);

interface RunningLineProps {
  readonly className: string | undefined;
  readonly messages: readonly BoardMessage[];
  /** Train notices stand above a rule; a notice for the whole display is inverted. */
  readonly emphasis: 'ruled' | 'inverted';
}

/** A field without text shows neither rule nor white bar. */
const RunningLine = ({ className, messages, emphasis }: RunningLineProps) => {
  const filled = messages.length > 0;
  return (
    <div
      className={className}
      data-inverted={emphasis === 'inverted' && filled}
      data-ruled={emphasis === 'ruled' && filled}
    >
      <Ticker
        messages={messages}
        separator={RUNNING_SEPARATOR}
        closeWithSeparator
        speed={RUNNING_SPEED}
      />
    </div>
  );
};

/**
 * "ICE 1028  Ankunft von Köln Hbf  Zug fällt aus": the train, where it goes — or where it
 * comes from when it ends here — the next via stop, and the notices that concern it.
 */
const followingText = (entry: BoardEntry, notices: TrainNotices): string => {
  const route =
    entry.kind === 'departure'
      ? [
          entry.destination.name,
          ...selectViaStops(entry.via, 1).stops.map((stop) => `via ${stop.name}`),
        ]
      : [`Ankunft von ${entry.origin.name}`];
  const hints = followingHints(entry, notices).map((message) => message.text ?? '');
  return [trainLabel(entry.train), ...route, ...hints].join(ROW_GAP);
};

/** Notices about the data itself; the original shows nothing of the kind. */
const dataNotices = (board: ZzaBoardViewModel): readonly BoardMessage[] => {
  if (board.state === 'loading') return [];
  if (board.state === 'unavailable') return [notice('Derzeit keine Zugdaten')];
  return board.stale ? [notice('Daten nicht aktuell')] : [];
};

/**
 * The delay is not among them: the expected-time box states it. The split is announced above
 * the first part only — see `splitNotice`.
 */
const trainHints = (
  entry: BoardEntry,
  notices: TrainNotices,
  messages: readonly BoardMessage[],
  { split }: { readonly split: boolean },
): readonly BoardMessage[] =>
  uniqueMessages([
    ...statusNotices(notices),
    ...(split ? splitNotice(notices) : []),
    ...routeNotices(entry, notices),
    ...shown(messages),
    ...platformChange(notices),
  ]);

/** A train ending here needs no "Fahrt endet hier" — the lower row says it in large type. */
const arrivalHints = (
  notices: TrainNotices,
  messages: readonly BoardMessage[],
): readonly BoardMessage[] =>
  uniqueMessages([...statusNotices(notices), ...shown(messages), ...platformChange(notices)]);

const followingHints = (entry: BoardEntry, notices: TrainNotices): readonly BoardMessage[] =>
  uniqueMessages([
    ...statusNotices(notices),
    ...routeNotices(entry, notices),
    ...shown(entry.messages),
  ]);

/**
 * "Zug wird in Gießen geteilt", as V3 words it, above the first part only: the second part's
 * line shows its via stops instead, and both lists mark the split. The V4 photograph reads
 * "Hinterer Zugteil nur bis Hof Hbf!", which needs to know which part runs at the back — the
 * source does not say.
 */
const splitNotice = ({ splitStop }: TrainNotices): BoardMessage[] =>
  splitStop === undefined ? [] : [notice(`Zug wird in ${splitStop.name} geteilt`)];

/**
 * A cancellation in the source's own words when it has them — they run among the source's
 * messages, where the source puts them — else in V4's, in this slot.
 */
const statusNotices = ({ replacement, cancellation }: TrainNotices): BoardMessage[] => [
  ...(replacement ? [notice('Ersatzzug')] : []),
  ...(cancellation !== undefined && cancellation.message === undefined
    ? [notice('Zug fällt aus', 'cancellation')]
    : []),
];

/** "Verspätung ca. 10 Min.", for the second part only — see `DELAY_STEP`. */
const delayNotice = (entry: BoardEntry): BoardMessage[] => {
  const rounded = Math.floor(announcedDelayMinutes(entry) / DELAY_STEP) * DELAY_STEP;
  return rounded > 0 ? [notice(`Verspätung ca. ${rounded} Min.`)] : [];
};

/**
 * The main train moved to another platform. On a platform display the view model puts such a
 * train into the following rows instead (ADR-0006), so this runs only on a station-wide one.
 */
const platformChange = ({ movedTo }: TrainNotices): BoardMessage[] =>
  movedTo === undefined ? [] : [notice(`Heute von Gleis ${movedTo}`)];

/** A route that differs from the timetable (ADR-0012), worded as V3 words it. */
const routeNotices = (entry: BoardEntry, { routeChanges }: TrainNotices): BoardMessage[] =>
  routeChanges.map((change) => notice(routeText(change, headlineStation(entry).name)));

const routeText = (change: RouteChange, destinationName: string): string => {
  if (change.kind === 'endsEarly') return `Heute nur bis ${destinationName}`;
  const stops = change.stops.map((stop) => stop.name).join(', ');
  return change.kind === 'skippedStops'
    ? `Heute ohne Halt in ${stops}`
    : `Heute mit zusätzlichem Halt in ${stops}`;
};

/** A quality notice is picked by its subject, every other message by its kind. */
const shown = (messages: readonly BoardMessage[]): BoardMessage[] =>
  messages.filter((message) =>
    message.kind === 'qualityNotice'
      ? PLATFORM_QUALITY_TOPICS.has(message.topic)
      : SHOWN_KINDS.has(message.kind),
  );

const notice = (text: string, kind: PlainMessageKind = 'info'): BoardMessage => ({ kind, text });
