import {
  FittedText,
  Ticker,
  TrainFormationDisplay,
  formatClockTime,
  formatDelay,
} from '@/components/zza';
import { headlineStation } from '@/domain/boardEntry';
import { displayableMessages } from '@/domain/message';
import { isSamePlatform } from '@/domain/station';
import { formatTrainRef } from '@/domain/train';
import { selectViaStops } from '@/domain/via';
import { useBlink } from '@/hooks/useBlink';
import { useRotation } from '@/hooks/useRotation';
import styles from './debug.module.css';
import type { BoardEntry } from '@/domain/boardEntry';
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
  const panel = useRotation(current === undefined ? EMPTY : panelsFor(current), 3_000);

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
            <span className={styles.delay}>{formatDelay(current.time) ?? '±0'}</span>
            <span className={styles.delay}>ist {formatClockTime(current.time.expected)}</span>
            <span className={styles.train}>
              {current.train.line ?? formatTrainRef(current.train)}
            </span>
          </div>

          <div className={styles.destination}>
            <FittedText>{routeText(current)}</FittedText>
          </div>

          <div className={styles.panel}>{panel ?? ''}</div>

          <div className={styles.row}>
            <span className={blinkVisible ? styles.hint : styles.hintHidden}>
              {hintFor(current, ready.platform) ?? ''}
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
            <span className={styles.followingDelay}>{formatDelay(entry.time) ?? ''}</span>
            <span>{entry.train.line ?? formatTrainRef(entry.train)}</span>
            <span className={styles.followingRoute}>{routeText(entry)}</span>
            <span>{hintFor(entry, ready.platform) ?? ''}</span>
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
const hintFor = (entry: BoardEntry, platform: string | undefined): string | undefined => {
  if (entry.status === 'cancelled') return 'FÄLLT AUS';
  const actual = entry.platform.actual;
  if (entry.platform.changed && actual !== undefined && !isSamePlatform(actual, platform)) {
    return `GLEIS ${actual}`;
  }
  if (entry.kind === 'terminatingArrival') return 'ENDET';
  return undefined;
};

/** What the rotating panel cycles through: the via stops, then each message. */
const panelsFor = (entry: BoardEntry): readonly string[] => {
  const viaStops =
    entry.kind === 'departure' && entry.via.length > 0
      ? [
          selectViaStops(entry.via, 3)
            .stops.map((stop) => stop.name)
            .join(' > '),
        ]
      : [];
  const texts = displayableMessages(entry.messages).map((message) => message.text ?? '');
  return [...viaStops, ...texts];
};
