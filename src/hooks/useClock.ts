import { useContext, useEffect, useState } from 'react';
import { ClockContext } from '@/app/ClockContext';
import { acceleratedClock, fixedClock, systemClock } from '@/platform/clock';
import type { Clock } from '@/platform/clock';
import type { DisplayConfig } from '@/app/config';

/** The configured clock, for code that needs the instant but not a re-render. */
export const useClock = (): Clock => useContext(ClockContext);

/**
 * The clock a configuration asks for, built **once per configuration**.
 *
 * The identity of the returned clock is part of the contract, not an optimisation: an
 * accelerated clock captures its starting point when it is constructed, so rebuilding it
 * would keep resetting the simulated time, and it would re-arm every interval that has
 * the clock as a dependency.
 *
 * Deliberately not `useMemo`: that is a cache React is allowed to discard, which is fine
 * for a recomputable value and not fine for an identity something depends on. State is
 * kept. The branch below is React's documented way of adjusting state when an input
 * changes — React discards this render and immediately renders again, without painting
 * in between.
 *
 * Takes `undefined` for the case where the configuration failed to parse, so callers can
 * invoke it unconditionally and keep their hook order stable.
 */
export const useConfiguredClock = (config: DisplayConfig | undefined): Clock => {
  const [current, setCurrent] = useState(() => build(config));

  if (current.config !== config) {
    const next = build(config);
    setCurrent(next);
    return next.clock;
  }
  return current.clock;
};

/** Pairs a clock with the configuration it was built from, so changes are detectable. */
const build = (config: DisplayConfig | undefined) => ({
  config,
  clock: config === undefined ? systemClock : clockFor(config),
});

/** Real time, a frozen instant, or an accelerated run starting at that instant (ADR-0004). */
const clockFor = (config: DisplayConfig): Clock => {
  if (config.simulatedTime === undefined) return systemClock;
  const start = new Date(config.simulatedTime);
  return config.timeFactor === undefined
    ? fixedClock(start)
    : acceleratedClock(start, config.timeFactor);
};

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
