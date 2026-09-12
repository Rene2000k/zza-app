import { displayableMessages } from '@/domain/message';
import styles from './zza.module.css';
import type { BoardMessage } from '@/domain/message';

export interface TickerProps {
  /** The queue, in the order it should run. */
  readonly messages: readonly BoardMessage[];
  /** Placed between two messages; the reference displays use " - " or " +++ ". */
  readonly separator?: string;
}

/**
 * The running message line: a display's footer, and the hint bar above a train's via line.
 *
 * A shared block because of what it owns, not because of how it looks (ADR-0009): the rule
 * that an unresolved code shows as nothing is enforced here instead of being remembered by
 * every design, and the movement will be too. It renders nothing when no message has a
 * text, and takes its colours from wherever the design places it.
 */
export const Ticker = ({ messages, separator = ' - ' }: TickerProps) => {
  const texts = displayableMessages(messages).map((message) => message.text);
  if (texts.length === 0) return null;
  return (
    <div className={styles.ticker} role="marquee">
      {texts.join(separator)}
    </div>
  );
};
