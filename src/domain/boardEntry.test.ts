import { describe, expect, it } from 'vitest';
import { delayMinutes, isDelayed, sortByPlannedTime, sortByTime } from './boardEntry';
import type { BoardEntry } from './boardEntry';

const at = (isoPlanned: string, isoExpected: string) => ({
  planned: new Date(isoPlanned),
  expected: new Date(isoExpected),
});

describe('delay derived from the two timestamps', () => {
  it('is zero when the train runs to plan', () => {
    const time = at('2026-09-10T08:00:00Z', '2026-09-10T08:00:00Z');
    expect(delayMinutes(time)).toBe(0);
    expect(isDelayed(time)).toBe(false);
  });

  it('truncates a part-minute delay downwards', () => {
    // 90 seconds late shows as one minute, the display convention.
    expect(delayMinutes(at('2026-09-10T08:00:00Z', '2026-09-10T08:01:30Z'))).toBe(1);
    // 59 seconds late is not yet a minute.
    expect(delayMinutes(at('2026-09-10T08:00:00Z', '2026-09-10T08:00:59Z'))).toBe(0);
  });

  it('truncates towards zero when the train is early', () => {
    // 30 seconds early is 0, not "one minute early" — flooring would overstate it.
    // Asserted with toBe, which also catches a negative zero leaking through.
    expect(delayMinutes(at('2026-09-10T08:00:00Z', '2026-09-10T07:59:30Z'))).toBe(0);
    expect(delayMinutes(at('2026-09-10T08:00:00Z', '2026-09-10T07:58:00Z'))).toBe(-2);
  });

  it('does not call an early train delayed', () => {
    expect(isDelayed(at('2026-09-10T08:00:00Z', '2026-09-10T07:58:00Z'))).toBe(false);
  });

  it('handles a delay across midnight', () => {
    expect(delayMinutes(at('2026-09-10T23:55:00Z', '2026-09-11T00:10:00Z'))).toBe(15);
  });
});

describe('board order', () => {
  const entry = (id: string, planned: string, expected: string): BoardEntry => ({
    kind: 'terminatingArrival',
    id,
    train: { category: 'RB', number: id },
    platform: { changed: false },
    time: at(planned, expected),
    status: 'onTime',
    messages: [],
    origin: { name: 'Dieburg' },
  });

  const late = entry('late', '2026-09-10T08:00:00Z', '2026-09-10T08:30:00Z');
  const next = entry('next', '2026-09-10T08:10:00Z', '2026-09-10T08:10:00Z');
  const alongside = entry('alongside', '2026-09-10T08:10:00Z', '2026-09-10T08:12:00Z');

  it('follows the expected time for what leaves next', () => {
    expect(sortByTime([late, next]).map((e) => e.id)).toEqual(['next', 'late']);
  });

  it('keeps a delayed train in its timetable place, and ties in the order given', () => {
    expect(sortByPlannedTime([alongside, late, next]).map((e) => e.id)).toEqual([
      'late',
      'alongside',
      'next',
    ]);
  });
});
