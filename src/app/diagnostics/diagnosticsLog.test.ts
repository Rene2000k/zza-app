import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@/providers/errors';
import { manualClock } from '@/platform/clock';
import {
  CONSOLE_PREFIX,
  LOG_CAPACITY,
  createDiagnosticsLog,
  formatDuration,
} from './diagnosticsLog';
import type { LogEntry } from './diagnosticsLog';

const start = new Date('2026-10-01T18:00:00Z');

const setup = () => {
  const clock = manualClock(start);
  const written: LogEntry[] = [];
  const log = createDiagnosticsLog(clock, (entry) => written.push(entry));
  return { clock, log, written };
};

describe('diagnostics log', () => {
  it('counts polls without logging every success', () => {
    const { log, written } = setup();
    log.boardSucceeded();
    log.boardSucceeded();

    expect(log.getSnapshot()).toMatchObject({ successes: 2, failures: 0, lastSuccessAt: start });
    expect(written).toEqual([]);
  });

  it('logs a failure with the HTTP status the source answered', () => {
    const { log, written } = setup();
    log.boardFailed(new ProviderError('IRIS request failed: 503', { status: 503 }));

    expect(written[0]).toMatchObject({ level: 'warn' });
    expect(written[0]?.text).toContain('HTTP 503');
    expect(log.getSnapshot().lastError?.message).toContain('HTTP 503');
  });

  it('turns a run of failures into one outage with its length, once data is back', () => {
    const { clock, log, written } = setup();
    log.boardSucceeded();
    clock.advance(30_000);
    const firstFailure = clock.now();
    log.boardFailed(new Error('Board fetch did not finish within 10000 ms'));
    clock.advance(30_000);
    log.boardFailed(new Error('Board fetch did not finish within 10000 ms'));
    expect(log.getSnapshot()).toMatchObject({ failureStreak: 2, outageSince: firstFailure });

    clock.advance(12 * 60_000);
    log.boardSucceeded();

    const snapshot = log.getSnapshot();
    expect(snapshot.outageSince).toBeUndefined();
    expect(snapshot.failureStreak).toBe(0);
    expect(snapshot.longestOutage).toMatchObject({ failures: 2 });
    expect(written.at(-1)?.text).toBe('Daten wieder da nach 13 min (2 Fehlversuche)');
  });

  it('keeps the longest outage, not the latest', () => {
    const { clock, log } = setup();
    log.boardFailed(new Error('x'));
    clock.advance(20 * 60_000);
    log.boardSucceeded();
    log.boardFailed(new Error('x'));
    clock.advance(60_000);
    log.boardSucceeded();

    const longest = log.getSnapshot().longestOutage;
    expect(longest && longest.to.getTime() - longest.from.getTime()).toBe(20 * 60_000);
  });

  it('keeps a bounded number of entries, dropping the oldest', () => {
    const { log } = setup();
    for (let i = 0; i < LOG_CAPACITY + 5; i += 1) log.note('info', `Eintrag ${i}`);

    const { entries } = log.getSnapshot();
    expect(entries).toHaveLength(LOG_CAPACITY);
    expect(entries[0]?.text).toBe('Eintrag 5');
    expect(entries[0]?.seq).toBe(6);
  });

  it('tells subscribers about every change', () => {
    const { log } = setup();
    const listener = vi.fn();
    const unsubscribe = log.subscribe(listener);
    log.boardSucceeded();
    unsubscribe();
    log.boardSucceeded();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('writes to the console with a prefix that can be filtered for', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createDiagnosticsLog(manualClock(start)).boardFailed(new Error('kaputt'));
    expect(warn).toHaveBeenCalledWith(
      `${CONSOLE_PREFIX} 2026-10-01T18:00:00.000Z Abruf fehlgeschlagen: kaputt`,
    );
    warn.mockRestore();
  });
});

describe('duration format', () => {
  it('is precise enough to match against an evening', () => {
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(12 * 60_000)).toBe('12 min');
    expect(formatDuration(125 * 60_000)).toBe('2 h 5 min');
  });
});
