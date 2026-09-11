import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { relevantEntries } from '@/domain/board';
import { createIrisProvider } from './index';

/**
 * End-to-end through this provider: real captured XML in, domain-model board out. The
 * network itself is stubbed (no live calls in a test run), but every byte it serves
 * here is the same real Bad Vilbel capture the mapping tests use. Only the plan hour
 * that was captured (2026-09-10, 16:00) has content; every other hour is served empty.
 */
const fixture = (name: string): string =>
  readFileSync(join(process.cwd(), 'src/providers/iris/__fixtures__', name), 'utf-8');

const CAPTURED_PLAN_HOUR = '/timetable/plan/8000760/260910/16';
const emptyPlan = "<timetable station='Bad Vilbel'></timetable>";

const ok = (body: string): Promise<Response> =>
  Promise.resolve(new Response(body, { status: 200, statusText: 'OK' }));

const stubFetch = () => {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/timetable/station/')) return ok(fixture('station-8000760.xml'));
    if (url.endsWith(CAPTURED_PLAN_HOUR)) return ok(fixture('plan-8000760-260910-16.xml'));
    if (url.includes('/timetable/plan/')) return ok(emptyPlan);
    if (url.includes('/timetable/fchg/')) return ok(fixture('fchg-8000760.xml'));
    throw new Error(`unexpected URL in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const callsTo = (fetchMock: ReturnType<typeof stubFetch>, path: string): string[] =>
  fetchMock.mock.calls.map(([url]) => url).filter((url) => url.includes(path));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createIrisProvider', () => {
  it('reports what IRIS actually delivers, honestly (ADR-0002)', () => {
    expect(createIrisProvider().capabilities).toEqual({
      plannedPlatform: true,
      platformChanges: true,
      terminatingArrivals: true,
      viaStops: true,
      delayCauses: 'codes',
      cancellations: true,
      formations: false,
      stationPlatformList: true,
    });
  });

  it('resolves a station by EVA number', async () => {
    stubFetch();
    const results = await createIrisProvider().resolveStation('8000760');
    expect(results).toEqual([
      { evaNumber: '8000760', name: 'Bad Vilbel', ds100: 'FVL', platforms: ['1', '2', '3'] },
    ]);
  });

  it('returns no candidates when IRIS has none', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok('<stations></stations>')));
    expect(await createIrisProvider().resolveStation('Xyzzyplatz123')).toEqual([]);
  });

  it('builds a real board from the station, the look-back and horizon plan hours, and fchg', async () => {
    const fetchMock = stubFetch();
    const now = new Date('2026-09-10T14:00:00Z'); // 16:00 Berlin
    const board = await createIrisProvider().getBoard({ station: '8000760', now, horizonMinutes: 30 });

    expect(board.station).toEqual({
      evaNumber: '8000760',
      name: 'Bad Vilbel',
      ds100: 'FVL',
      platforms: ['1', '2', '3'],
    });
    expect(board.entries).toHaveLength(13);
    expect(board.fetchedAt).toBe(now);
    // 120 minutes back from 16:00 plus 30 ahead: hours 14, 15 and 16 (ADR-0008).
    expect(callsTo(fetchMock, '/timetable/plan/').map((url) => url.slice(-2))).toEqual([
      '14',
      '15',
      '16',
    ]);
    expect(callsTo(fetchMock, '/timetable/station/')).toHaveLength(1);
    expect(callsTo(fetchMock, '/timetable/fchg/')).toHaveLength(1);
  });

  it('still shows a train planned in an earlier hour and delayed into the window (ADR-0008)', async () => {
    // Real case from the capture: RB 15735, planned 16:58, expected 17:04. At 17:02 the
    // current hour is 17, so the train's plan entry lives in the 16:00 hour — without the
    // look-back it would never be fetched and the train would be missing.
    const fetchMock = stubFetch();
    const now = new Date('2026-09-10T15:02:00Z'); // 17:02 Berlin
    const board = await createIrisProvider().getBoard({ station: '8000760', now, horizonMinutes: 30 });

    expect(callsTo(fetchMock, CAPTURED_PLAN_HOUR)).toHaveLength(1);
    const shown = relevantEntries(board.entries, now).find(
      (entry) => entry.id === '760501916431835347-2609101607-14',
    );
    expect(shown?.time).toEqual({
      planned: new Date('2026-09-10T14:58:00Z'),
      expected: new Date('2026-09-10T15:04:00Z'),
    });
  });

  it('filters the board to a platform (ADR-0006) using the shared domain rule', async () => {
    stubFetch();
    const now = new Date('2026-09-10T14:00:00Z');
    const board = await createIrisProvider().getBoard({
      station: '8000760',
      platform: '3',
      now,
      horizonMinutes: 30,
    });
    // Every mapped entry keeps its own planned/actual platform; this only checks the
    // filter actually narrowed the board rather than returning everything.
    expect(board.entries.length).toBeGreaterThan(0);
    expect(board.entries.length).toBeLessThan(13);
    expect(board.platform).toBe('3');
  });

  it('caches station details instead of refetching them on every board request', async () => {
    const fetchMock = stubFetch();
    const provider = createIrisProvider();
    const now = new Date('2026-09-10T14:00:00Z');
    await provider.getBoard({ station: '8000760', now, horizonMinutes: 10 });
    await provider.getBoard({ station: '8000760', now, horizonMinutes: 10 });

    expect(callsTo(fetchMock, '/timetable/station/')).toHaveLength(1);
  });

  it('fetches each plan hour once but refetches fchg on every poll (ADR-0008)', async () => {
    const fetchMock = stubFetch();
    const provider = createIrisProvider();
    const now = new Date('2026-09-10T14:00:00Z'); // 16:00 Berlin, hours 14–16
    const plans = () => callsTo(fetchMock, '/timetable/plan/').map((url) => url.slice(-2));

    await provider.getBoard({ station: '8000760', now, horizonMinutes: 30 });
    await provider.getBoard({ station: '8000760', now, horizonMinutes: 30 });
    expect(plans()).toEqual(['14', '15', '16']);

    // 61 minutes later hour 14 has left the window and hour 17 has entered it: only the
    // new hour is fetched, the others are still served from the cache.
    const later = new Date(now.getTime() + 61 * 60_000);
    await provider.getBoard({ station: '8000760', now: later, horizonMinutes: 30 });
    expect(plans()).toEqual(['14', '15', '16', '17']);

    expect(callsTo(fetchMock, '/timetable/fchg/')).toHaveLength(3);
  });

  it('fails without fetching the board when IRIS knows no station under the EVA number', async () => {
    const fetchMock = vi.fn((url: string) =>
      ok(url.includes('/timetable/station/') ? '<stations></stations>' : '<timetable></timetable>'),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      createIrisProvider().getBoard({
        station: '9999999',
        now: new Date('2026-09-10T14:00:00Z'),
        horizonMinutes: 30,
      }),
    ).rejects.toThrow(/9999999/);
    expect(callsTo(fetchMock, '/timetable/plan/')).toHaveLength(0);
    expect(callsTo(fetchMock, '/timetable/fchg/')).toHaveLength(0);
  });
});
