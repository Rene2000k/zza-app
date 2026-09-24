import { displayableMessages } from '@/domain/message';
import { Marquee } from './Marquee';
import type { BoardMessage } from '@/domain/message';

export interface TickerProps {
  /** The queue, in the order it should run. */
  readonly messages: readonly BoardMessage[];
  /** Placed between two messages; the reference displays use " - " or " +++ ". */
  readonly separator?: string;
  /**
   * Also end the line with the separator once it holds more than one message, so a repeating
   * line reads "A +++ B +++" before it starts over. A single message stays bare.
   */
  readonly closeWithSeparator?: boolean;
  /** Travel in canvas pixels per second. */
  readonly speed?: number;
}

/**
 * The running message line: a display's footer, and the hint bar above a train's via line.
 *
 * A shared block because of what it owns, not because of how it looks (ADR-0009): the rule
 * that an unresolved code shows as nothing is enforced here instead of being remembered by
 * every design, and the running itself comes from `Marquee`, which leaves a short message
 * standing. It renders nothing when no message has a text, and takes its colours from
 * wherever the design places it.
 */
export const Ticker = ({
  messages,
  separator = ' - ',
  closeWithSeparator = false,
  speed,
}: TickerProps) => {
  const texts = displayableMessages(messages).map((message) => message.text);
  if (texts.length === 0) return null;
  const closes = closeWithSeparator && texts.length > 1;
  const closing = separator.trimEnd();
  // A closed line runs straight into its next round with the separator's own trailing space,
  // not with the marquee's default gap, so "zwei +++ eins" reads like any other join.
  const gap = closes ? { gap: separator.slice(closing.length) } : {};
  return (
    <div role="marquee">
      <Marquee {...(speed === undefined ? {} : { speed })} {...gap}>
        {texts.join(separator) + (closes ? closing : '')}
      </Marquee>
    </div>
  );
};
