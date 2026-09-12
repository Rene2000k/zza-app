import { describe, expect, it } from 'vitest';
import { formatClockTime, formatDelay } from './format';

const planned = new Date('2026-09-11T10:52:00+02:00');
const time = (minutes: number) => ({
  planned,
  expected: new Date(planned.getTime() + minutes * 60_000),
});

describe('formatClockTime', () => {
  it('prints hours and minutes in station time', () => {
    expect(formatClockTime(planned)).toBe('10:52');
  });

  it('prints whichever instant it is given, so a design can state either one', () => {
    expect(formatClockTime(time(12).expected)).toBe('11:04');
  });
});

describe('formatDelay', () => {
  it('prints whole minutes late', () => {
    expect(formatDelay(time(7))).toBe('+7');
  });

  it('says nothing for a train on time, early, or under a minute late', () => {
    expect(formatDelay(time(0))).toBeUndefined();
    expect(formatDelay(time(-3))).toBeUndefined();
    expect(
      formatDelay({ planned, expected: new Date(planned.getTime() + 50_000) }),
    ).toBeUndefined();
  });
});
