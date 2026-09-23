import '@fontsource/roboto-condensed/latin-400.css';
import '@fontsource/roboto-condensed/latin-ext-400.css';
import {
  FittedText,
  Ticker,
  TrainFormationDisplay,
  formatClockTime,
  formatDelay,
} from '@/components/zza';
import { delayMinutes, headlineStation } from '@/domain/boardEntry';
import { displayableMessages } from '@/domain/message';
import { isSamePlatform } from '@/domain/station';
import { formatTrainRef } from '@/domain/train';
import { selectViaStops } from '@/domain/via';
import styles from './v3-5x2.module.css';
import type { BoardEntry, EntryTime } from '@/domain/boardEntry';
import type { BoardMessage, MessageKind } from '@/domain/message';
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
 */
export const V3_5x2 = ({ board }: V3_5x2Props) => {
  const ready = board.state === 'ready' ? board : undefined;
  const current = ready?.current;
  const platform = ready?.platform ?? current?.platform.actual ?? current?.platform.planned;

  return (
    <div className={styles.display}>
      {current === undefined ? null : <MainTrain entry={current} />}
      <RunningLine className={styles.mainHint} messages={mainHints(board)} />
      <div className={styles.platform}>{platform}</div>

      <div className={styles.followingLabel}>Folgezüge:</div>
      {ready?.following.slice(0, FOLLOWING_ROWS).map((entry, row) => (
        <FollowingTrain key={entry.id} entry={entry} row={row} />
      ))}

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
      <FittedText>{trainLabel(entry)}</FittedText>
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

const FollowingTrain = ({ entry, row }: { readonly entry: BoardEntry; readonly row: number }) => (
  <div className={row === 0 ? styles.followingFirst : styles.followingSecond}>
    <div className={styles.followingTime}>{formatClockTime(entry.time.planned)}</div>
    <DeviationField className={styles.followingDeviation} time={entry.time} />
    <div className={styles.followingTrain}>
      <FittedText>{trainLabel(entry)}</FittedText>
    </div>
    <div className={styles.followingDestination}>
      <FittedText>{headline(entry)}</FittedText>
    </div>
    <RunningLine className={styles.followingHint} messages={followingHints(entry)} />
  </div>
);

interface FieldProps {
  readonly className: string | undefined;
}

/**
 * A field without text stays blue: the real display shows no empty white bar. Several notices
 * also end on the separator, so the line reads the same when it starts over.
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

/** A following train states its deviation, "+7", never the expected time. */
const DeviationField = ({ className, time }: FieldProps & { readonly time: EntryTime }) => {
  const deviation = formatDelay(time);
  return (
    <div className={className} data-inverted={deviation !== undefined}>
      {deviation}
    </div>
  );
};

const trainLabel = (entry: BoardEntry): string => entry.train.line ?? formatTrainRef(entry.train);

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
  const trainHints =
    current === undefined
      ? []
      : unique([
          ...statusNotices(current, board.messages, 'Zug fällt aus'),
          ...(current.kind === 'terminatingArrival' ? [notice('Fahrt endet hier')] : []),
          ...delayNotice(current),
          ...shown(board.messages),
          ...platformChange(current, board.platform),
        ]);
  return trainHints.length === 0 && board.stale ? [notice('Daten nicht aktuell')] : trainHints;
};

const followingHints = (entry: BoardEntry): readonly BoardMessage[] =>
  unique([
    ...statusNotices(entry, entry.messages, 'Fällt aus'),
    ...(entry.kind === 'terminatingArrival' ? [notice('Zug endet hier')] : []),
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
 * Only announced for now: moving the train into the following rows is a later step, so the
 * platform field itself keeps showing the platform the display stands at.
 */
const platformChange = (entry: BoardEntry, platform: string | undefined): BoardMessage[] => {
  const { actual, changed } = entry.platform;
  return changed && actual !== undefined && !isSamePlatform(actual, platform)
    ? [notice(`Heute von Gleis ${actual}`)]
    : [];
};

const shown = (messages: readonly BoardMessage[]): BoardMessage[] =>
  messages.filter((message) => SHOWN_KINDS.has(message.kind));

const notice = (text: string, kind: MessageKind = 'info'): BoardMessage => ({ kind, text });

/** The same text often arrives from the stop and from the movement; a line says it once. */
const unique = (messages: readonly BoardMessage[]): BoardMessage[] => {
  const seen = new Set<string>();
  return displayableMessages(messages).filter((message) => {
    const text = message.text ?? '';
    if (seen.has(text)) return false;
    seen.add(text);
    return true;
  });
};
