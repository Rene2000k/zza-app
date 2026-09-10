import { describe, expect, it } from 'vitest';
import { acceleratedClock, fixedClock, manualClock } from './clock';

/**
 * All instants here are UTC so that the expected values can be read off directly.
 * Timezone handling belongs to formatting, which the clock does not do.
 */
describe('clock port', () => {
  it('freezes time', () => {
    const clock = fixedClock(new Date('2026-09-10T08:15:00Z'));
    expect(clock.now().toISOString()).toBe('2026-09-10T08:15:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-09-10T08:15:00.000Z');
  });

  it('does not hand out a mutable reference to its own instant', () => {
    const clock = fixedClock(new Date('2026-09-10T08:15:00Z'));
    const first = clock.now();
    first.setFullYear(1999);
    expect(clock.now().toISOString()).toBe('2026-09-10T08:15:00.000Z');
  });

  it('advances only when told to', () => {
    const clock = manualClock(new Date('2026-09-10T08:15:00Z'));
    clock.advance(90_000);
    expect(clock.now().toISOString()).toBe('2026-09-10T08:16:30.000Z');
  });

  it('scales elapsed time by the factor', () => {
    const reference = manualClock(new Date('2026-09-10T00:00:00Z'));
    const clock = acceleratedClock(new Date('2026-09-10T08:00:00Z'), 60, reference);
    reference.advance(1_000); // one real second
    expect(clock.now().toISOString()).toBe('2026-09-10T08:01:00.000Z'); // one simulated minute
    reference.advance(59_000); // a real minute in total
    expect(clock.now().toISOString()).toBe('2026-09-10T09:00:00.000Z'); // a simulated hour
  });

  it('runs at real speed with a factor of one', () => {
    const reference = manualClock(new Date('2026-09-10T00:00:00Z'));
    const clock = acceleratedClock(new Date('2026-09-10T08:00:00Z'), 1, reference);
    reference.advance(120_000);
    expect(clock.now().toISOString()).toBe('2026-09-10T08:02:00.000Z');
  });
});
