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
import { delayMinutes, headlineStation } from '@/domain/boardEntry';
import { splitStop } from '@/domain/coupling';
import { displayableMessages, PLATFORM_QUALITY_TOPICS, uniqueMessages } from '@/domain/message';
import { isSamePlatform } from '@/domain/station';
import { trainLabel } from '@/domain/train';
import { selectViaStops } from '@/domain/via';
import styles from './v3-5x2.module.css';
import type { BoardEntry } from '@/domain/boardEntry';
import type { BoardMessage, MessageKind, PlainMessageKind } from '@/domain/message';
import type { RouteChange } from '@/domain/routeChange';
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

  return (
    <div className={styles.display}>
      {current === undefined ? null : <MainTrain entry={current} />}
      <RunningLine className={styles.mainHint} messages={mainHints(board)} />
      <div className={styles.platform}>{platform}</div>

      {current === undefined || secondPart === undefined ? (
        <>
          <div className={styles.followingLabel}>Folgezüge:</div>
          {ready?.following.slice(0, FOLLOWING_ROWS).map((entry, row) => (
            <FollowingTrain key={entry.id} entry={entry} row={row} platform={ready?.platform} />
          ))}
        </>
      ) : (
        <div className={styles.secondPart}>
          <MainTrain entry={secondPart} />
          <RunningLine
            className={styles.mainHint}
            messages={trainHints(secondPart, secondPart.messages, ready?.platform, current)}
          />
        </div>
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

const MainTrain = ({ entry }: { readonly entry: BoardEntry }) => (
  <>
    <div className={styles.time}>{formatClockTime(entry.time.planned)}</div>
    <div className={styles.train}>
      <FittedText>{trainLabel(entry.train)}</FittedText>
      <HaltPictograms entry={entry} />
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
    <RunningLine className={styles.followingHint} messages={followingHints(entry, platform)} />
  </div>
);

/**
 * H+ and H− beside the main train's name (ADR-0013). No photograph shows them on this
 * generation, so they take the place V4 gives them: right of the train, as tall as its band,
 * which squeezes a long train name rather than covering it. The following rows have no room
 * and carry the change in their running line only.
 */
const HaltPictograms = ({ entry }: { readonly entry: BoardEntry }) => {
  const pictograms = haltChangePictograms(entry);
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
  const deviation = entry.status === 'cancelled' ? undefined : formatDelay(entry.time);
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
const mainHints = (board: ZzaBoardViewModel): readonly BoardMessage[] => {
  if (board.state === 'loading') return [];
  if (board.state === 'unavailable') return [notice('Derzeit keine Zugdaten')];

  const { current } = board;
  const hints =
    current === undefined
      ? []
      : trainHints(current, board.messages, board.platform, board.secondPart);
  return hints.length === 0 && board.stale ? [notice('Daten nicht aktuell')] : hints;
};

/**
 * What runs above a train in the upper layout: the main train's, or that of the second part
 * of a coupled one, which says the same about itself.
 */
const trainHints = (
  entry: BoardEntry,
  messages: readonly BoardMessage[],
  platform: string | undefined,
  partner: BoardEntry | undefined,
): readonly BoardMessage[] =>
  uniqueMessages([
    ...statusNotices(entry, messages, 'Zug fällt aus'),
    ...(entry.kind === 'terminatingArrival' ? [notice('Fahrt endet hier')] : []),
    ...splitNotice(entry, partner),
    ...delayNotice(entry),
    ...routeNotices(entry),
    ...shown(messages),
    ...platformChange(entry, platform),
  ]);

/**
 * "Zug wird in Gießen geteilt", above both parts, as the real displays word it. Nothing is
 * said where the parts share no stop ahead to name, or where one of them does not run.
 */
const splitNotice = (entry: BoardEntry, partner: BoardEntry | undefined): BoardMessage[] => {
  if (partner === undefined || entry.status === 'cancelled' || partner.status === 'cancelled') {
    return [];
  }
  const stop = splitStop(entry, partner);
  return stop === undefined ? [] : [notice(`Zug wird in ${stop.name} geteilt`)];
};

/** A train that changed away leads the following rows, and its line says so first. */
const followingHints = (entry: BoardEntry, platform: string | undefined): readonly BoardMessage[] =>
  uniqueMessages([
    ...platformChange(entry, platform),
    ...statusNotices(entry, entry.messages, 'Fällt aus'),
    ...(entry.kind === 'terminatingArrival' ? [notice('Zug endet hier')] : []),
    ...routeNotices(entry),
    ...shown(entry.messages),
  ]);

/** A cancellation the source already words is not announced a second time. */
const statusNotices = (
  entry: BoardEntry,
  messages: readonly BoardMessage[],
  cancelledWording: string,
): BoardMessage[] => {
  if (entry.status === 'replacement') return [notice('Ersatzzug')];
  const worded = displayableMessages(messages).some((message) => message.kind === 'cancellation');
  return entry.status === 'cancelled' && !worded ? [notice(cancelledWording, 'cancellation')] : [];
};

/**
 * "Verspätung ca. 10 Min.", rounded down to five minutes — which leaves nothing to say below
 * five. A cancelled train has no delay worth announcing.
 */
const delayNotice = (entry: BoardEntry): BoardMessage[] => {
  if (entry.status === 'cancelled') return [];
  const rounded = Math.floor(delayMinutes(entry.time) / DELAY_STEP) * DELAY_STEP;
  return rounded > 0 ? [notice(`Verspätung ca. ${rounded} Min.`)] : [];
};

/**
 * A train that left this display's platform. On a platform display the view model never makes
 * it the main train but puts it at the top of the following rows (ADR-0006), so in practice
 * the main train carries this only on a station-wide display. The platform field keeps
 * showing the platform the display stands at.
 */
const platformChange = (entry: BoardEntry, platform: string | undefined): BoardMessage[] => {
  const { actual, changed } = entry.platform;
  return changed && actual !== undefined && !isSamePlatform(actual, platform)
    ? [notice(`Heute von Gleis ${actual}`)]
    : [];
};

/** A quality notice is picked by its subject, every other message by its kind. */
/**
 * What the display says about a route that differs from the timetable (ADR-0012).
 *
 * The model states the case and the stops; the wording is this design's, after the real V3
 * displays. Every affected station is named, however many there are — that is what the
 * original does, and shortening the list would drop the one name a traveller is waiting for.
 * "Heute nur bis" takes the destination from the entry, which already names where the train
 * really ends.
 */
const routeNotices = (entry: BoardEntry): BoardMessage[] => {
  if (entry.kind !== 'departure') return [];
  return entry.routeChanges.map((change) => notice(routeText(change, entry.destination.name)));
};

const routeText = (change: RouteChange, destinationName: string): string => {
  if (change.kind === 'endsEarly') return `Heute nur bis ${destinationName}`;
  const stops = stopNames(change);
  return change.kind === 'skippedStops'
    ? `Heute ohne Halt in ${stops}`
    : `Heute mit zusätzlichem Halt in ${stops}`;
};

const stopNames = (change: RouteChange): string => change.stops.map((stop) => stop.name).join(', ');

const shown = (messages: readonly BoardMessage[]): BoardMessage[] =>
  messages.filter((message) =>
    message.kind === 'qualityNotice'
      ? PLATFORM_QUALITY_TOPICS.has(message.topic)
      : SHOWN_KINDS.has(message.kind),
  );

const notice = (text: string, kind: PlainMessageKind = 'info'): BoardMessage => ({ kind, text });
