/**
 * The clock port (ADR-0004).
 *
 * This is the only module allowed to read the system clock; a lint rule enforces that
 * for the rest of `src`. Everything else takes a Clock, so any display state — a
 * cancellation, a platform change, midnight, a DST switch — can be reproduced on demand
 * instead of waited for.
 */
export interface Clock {
  /** The current instant according to this clock. */
  now(): Date;
}

/** Real time. The implementation used in normal operation. */
export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock frozen at one instant. Every call returns the same time. */
export const fixedClock = (instant: Date): Clock => ({
  now: () => new Date(instant.getTime()),
});

/**
 * A clock that starts at `start` and then runs at `factor` times real speed.
 *
 * `factor` of 1 behaves like the system clock offset to `start`; 60 turns a minute
 * into a second, which is how a whole operating day gets inspected in a few minutes.
 */
export const acceleratedClock = (start: Date, factor: number, reference: Clock = systemClock): Clock => {
  const origin = reference.now().getTime();
  return {
    now: () => new Date(start.getTime() + (reference.now().getTime() - origin) * factor),
  };
};

/**
 * A clock a test can advance by hand. Nothing happens between calls to `advance`,
 * which makes assertions about timers deterministic.
 */
export interface ManualClock extends Clock {
  advance(milliseconds: number): void;
  set(instant: Date): void;
}

export const manualClock = (start: Date): ManualClock => {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance: (milliseconds) => {
      current += milliseconds;
    },
    set: (instant) => {
      current = instant.getTime();
    },
  };
};
