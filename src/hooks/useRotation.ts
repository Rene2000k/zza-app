import { useEffect, useState } from 'react';

/**
 * Cycles through items on a fixed interval — the "via line, then message, then via line
 * again" alternation real displays run, and the page changes of a multi-train board.
 *
 * Exists so no design writes its own timer: one implementation, one place where a stray
 * interval could leak. A list of one never starts a timer, an empty list yields undefined.
 */
export const useRotation = <T>(items: readonly T[], intervalMs: number): T | undefined => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const handle = setInterval(() => setStep((previous) => previous + 1), intervalMs);
    return () => clearInterval(handle);
  }, [items.length, intervalMs]);

  // Counting up and wrapping on read keeps the position when the list is replaced by an
  // equally long one, which is what happens on every poll.
  return items.length === 0 ? undefined : items[step % items.length];
};
