import { describe, expect, it } from 'vitest';
import { berlinDateHour, berlinHoursCovering, parseIrisTimestamp } from './berlinTime';

describe('parseIrisTimestamp', () => {
  it('parses a winter timestamp at CET (+1)', () => {
    expect(parseIrisTimestamp('2601150800')).toEqual(new Date('2026-01-15T07:00:00Z'));
  });

  it('parses a summer timestamp at CEST (+2)', () => {
    expect(parseIrisTimestamp('2607150800')).toEqual(new Date('2026-07-15T06:00:00Z'));
  });

  it('resolves to CEST just after the spring-forward transition', () => {
    // Germany 2026: clocks go 02:00 CET -> 03:00 CEST on 2026-03-29.
    expect(parseIrisTimestamp('2603291200')).toEqual(new Date('2026-03-29T10:00:00Z'));
  });

  it('resolves to CET just after the fall-back transition', () => {
    // Germany 2026: clocks go 03:00 CEST -> 02:00 CET on 2026-10-25.
    expect(parseIrisTimestamp('2610251200')).toEqual(new Date('2026-10-25T11:00:00Z'));
  });

  it('rejects a malformed timestamp rather than guessing', () => {
    expect(() => parseIrisTimestamp('not-a-timestamp')).toThrow();
  });
});

describe('berlinDateHour', () => {
  it('reports the Europe/Berlin wall-clock date and hour, not UTC', () => {
    // 14:30 UTC is 16:30 in Berlin in September (CEST).
    expect(berlinDateHour(new Date('2026-09-10T14:30:00Z'))).toEqual({
      yymmdd: '260910',
      hh: '16',
    });
  });

  it('rolls the date over at the Berlin midnight, not the UTC one', () => {
    // 23:30 UTC on the 9th is already 00:30 on the 10th in winter Berlin (CET).
    expect(berlinDateHour(new Date('2026-01-09T23:30:00Z'))).toEqual({
      yymmdd: '260110',
      hh: '00',
    });
  });
});

describe('berlinHoursCovering', () => {
  it('covers a two-hour horizon with three hour buckets', () => {
    // now = 16:00 Berlin; a 120-minute horizon reaches exactly 18:00 Berlin.
    const now = new Date('2026-09-10T14:00:00Z');
    expect(berlinHoursCovering(now, 120)).toEqual([
      { yymmdd: '260910', hh: '16' },
      { yymmdd: '260910', hh: '17' },
      { yymmdd: '260910', hh: '18' },
    ]);
  });

  it('adds the partial final hour when the horizon does not land on a boundary', () => {
    // now = 16:45 Berlin; +30 minutes reaches 17:15, still inside hour 17.
    const now = new Date('2026-09-10T14:45:00Z');
    expect(berlinHoursCovering(now, 30)).toEqual([
      { yymmdd: '260910', hh: '16' },
      { yymmdd: '260910', hh: '17' },
    ]);
  });

  it('returns a single bucket for a short horizon within the current hour', () => {
    const now = new Date('2026-09-10T14:00:00Z');
    expect(berlinHoursCovering(now, 10)).toEqual([{ yymmdd: '260910', hh: '16' }]);
  });
});
