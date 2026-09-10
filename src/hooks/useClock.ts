import { useContext, useEffect, useState } from 'react';
import { ClockContext } from '@/app/ClockContext';
import type { Clock } from '@/platform/clock';

/** The configured clock, for code that needs the instant but not a re-render. */
export const useClock = (): Clock => useContext(ClockContext);

/**
 * The current time, re-rendered on a tick.
 *
 * A display shows seconds, so the default tick is one second. The tick is driven by
 * an interval while the time itself comes from the clock — a frozen clock therefore
 * keeps returning the same instant, which is the point of the demo mode.
 */
export const useNow = (tickMs = 1000): Date => {
  const clock = useClock();
  // The clock is read in the initialiser and then in the interval callback — never
  // synchronously inside the effect body, which would cause a cascading render.
  // Swapping the clock takes effect on the following tick; clocks change on
  // configuration load, not mid-session, so that is not worth extra machinery.
  const [now, setNow] = useState<Date>(() => clock.now());

  useEffect(() => {
    const handle = setInterval(() => setNow(clock.now()), tickMs);
    return () => clearInterval(handle);
  }, [clock, tickMs]);

  return now;
};
