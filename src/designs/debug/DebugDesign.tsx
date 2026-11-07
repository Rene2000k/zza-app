import {
  FittedText,
  Ticker,
  TrainFormationDisplay,
  formatClockTime,
  formatDelay,
} from '@/components/zza';
import { delayMinutes, headlineStation } from '@/domain/boardEntry';
import { displayableMessages } from '@/domain/message';
import { trainLabel } from '@/domain/train';
import { trainNotices } from '@/domain/trainNotices';
import { selectViaStops } from '@/domain/via';
import { useBlink } from '@/hooks/useBlink';
import { useRotation } from '@/hooks/useRotation';
import styles from './debug.module.css';
import type { BoardEntry } from '@/domain/boardEntry';
import type { NoticeContext, TrainNotices } from '@/domain/trainNotices';
import type { ZzaBoardViewModel } from '@/hooks/useZzaBoard';

export interface DebugDesignProps {
  readonly board: ZzaBoardViewModel;
}

/**
 * A design built to look wrong on purpose.
 *
 * Its job is to prove that the core is design-independent: the app, the view model and the
 * shared blocks know nothing about it, and every decision a design makes — wording, which
 * statement a field prints, layout, tokens — it makes visibly differently from how a replica
 * would. It shows the delay twice, as "+12" and as the actual time, because that difference
 * is exactly what separates two real generations. It also renders every state the view model
 * can be in, which is what makes it the reference case in the playground.
 */
export const DebugDesign = ({ board }: DebugDesignProps) => {
  const ready = board.state === 'ready' ? board : undefined;
  const current = ready?.current;

  // Hooks run in the same order whatever the board's state is, so they come first.
  const blinkVisible = useBlink(700);
  const context: NoticeContext = { platform: ready?.platform };
  const panel = useRotation(current === undefined ? EMPTY : panelsFor(current, context), 3_000);

  if (board.state === 'loading') {
    return (
      <div className={styles.screen}>
        <p className={styles.state}>lädt…</p>
      </div>
    );
  }
  if (board.state === 'unavailable' || ready === undefined) {
    return (
      <div className={styles.screen}>
        <p className={styles.state}>keine Daten</p>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <span>{ready.station.name}</span>
        <span>{ready.platform === undefined ? 'alle Gleise' : `Gleis ${ready.platform}`}</span>
        <span>
          {ready.dataAgeSeconds}s{ready.stale ? ' · veraltet' : ''}
        </span>
      </header>

      {current === undefined ? (
        <p className={styles.state}>kein Zug im Anzeigezeitraum</p>
      ) : (
        <section className={styles.main}>
          <div className={styles.times}>
            <span className={styles.time}>{formatClockTime(current.time.planned)}</span>
            <span className={styles.delay}>{formatDelay(delayMinutes(current.time)) ?? '±0'}</span>
            <span className={styles.delay}>ist {formatClockTime(current.time.expected)}</span>
            <span className={styles.train}>{trainLabel(current.train)}</span>
          </div>

          <div className={styles.destination}>
            <FittedText>{routeText(current)}</FittedText>
          </div>

          <div className={styles.panel}>{panel ?? ''}</div>

          <div className={styles.row}>
            <span className={blinkVisible ? styles.notice : styles.noticeHidden}>
              {noticeFor(current, context) ?? ''}
            </span>
            <span className={styles.formation}>
              <TrainFormationDisplay formation={current.formation} />
            </span>
          </div>
        </section>
      )}

      <ul className={styles.following}>
        {ready.following.map((entry) => (
          <li key={entry.id}>
            <span className={styles.followingTime}>{formatClockTime(entry.time.planned)}</span>
            <span className={styles.followingDelay}>
              {formatDelay(delayMinutes(entry.time)) ?? ''}
            </span>
            <span>{trainLabel(entry.train)}</span>
            <span className={styles.followingRoute}>{routeText(entry)}</span>
            <span>{noticeFor(entry, context) ?? ''}</span>
          </li>
        ))}
      </ul>

      <footer className={styles.foot}>
        <Ticker messages={ready.messages} speed={80} />
      </footer>
    </div>
  );
};

const EMPTY: readonly string[] = [];
/** Where the train goes, or where it came from when it ends here. */
const routeText = (entry: BoardEntry): string =>
  entry.kind === 'terminatingArrival'
    ? `von ${headlineStation(entry).name}`
    : headlineStation(entry).name;

/**
 * The wording is this design's own, shouted in capitals so nobody mistakes it for a replica.
 * A cancellation outranks a platform change, which outranks a train ending here.
 */
const noticeFor = (entry: BoardEntry, context: NoticeContext): string | undefined => {
  const notices = trainNotices(entry, context);
  if (notices.cancellation !== undefined) return 'FÄLLT AUS';
  if (notices.movedTo !== undefined) return `GLEIS ${notices.movedTo}`;
  if (entry.kind === 'terminatingArrival') return 'ENDET';
  return undefined;
};

/** What the rotating panel cycles through: the via stops, the route changes, then each message. */
const panelsFor = (entry: BoardEntry, context: NoticeContext): readonly string[] => {
  const viaStops =
    entry.kind === 'departure' && entry.via.length > 0
      ? [
          selectViaStops(entry.via, 3)
            .stops.map((stop) => stop.name)
            .join(' > '),
        ]
      : [];
  const texts = displayableMessages(entry.messages).map((message) => message.text ?? '');
  return [...viaStops, ...routeTexts(entry, trainNotices(entry, context)), ...texts];
};

/**
 * Halt changes in this design's own shouted wording, nothing like the replica's sentences.
 *
 * That difference is the point: the model carries a case and a list of stops, never a phrase
 * (ADR-0012), so two designs can say the same thing in two ways without the provider knowing
 * either of them.
 */
const routeTexts = (entry: BoardEntry, notices: TrainNotices): readonly string[] =>
  notices.routeChanges.map((change) => {
    const stops = change.stops.map((stop) => stop.name).join(' / ');
    if (change.kind === 'skippedStops') return `OHNE: ${stops}`;
    if (change.kind === 'additionalStops') return `EXTRA: ${stops}`;
    return `NUR BIS ${headlineStation(entry).name}`;
  });
