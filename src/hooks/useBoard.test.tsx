import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { displayConfigSchema } from '@/app/config';
import { jitteredIntervalMs, seededUnit, useBoard, withTimeout } from './useBoard';
import { useNow } from './useClock';

describe('jitteredIntervalMs', () => {
  it('varies the configured interval by at most ±10 %', () => {
    expect(jitteredIntervalMs(30, () => 0)).toBe(27_000);
    expect(jitteredIntervalMs(30, () => 0.5)).toBe(30_000);
    expect(jitteredIntervalMs(30, () => 0.999_999)).toBe(33_000);
  });
});

describe('seededUnit', () => {
  it('gives the same value for the same seed, so a render between two polls changes nothing', () => {
    const seed = Date.UTC(2026, 8, 10, 14, 0, 0, 123);
    expect(seededUnit(seed)).toBe(seededUnit(seed));
  });

  it('stays within [0, 1) and differs between seeds a millisecond apart', () => {
    const seeds = Array.from({ length: 1_000 }, (_, offset) => Date.UTC(2026, 8, 10) + offset);
    const values = seeds.map(seededUnit);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(990);
  });
});

describe('useBoard polling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps polling while the display re-renders every second', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T14:00:00Z'));
    const config = displayConfigSchema.parse({
      station: '8000105',
      platform: '9',
      provider: 'mock',
    });
    const client = new QueryClient();
    const fetchedAt = new Set<number>();

    /** Ticks like a real display does, which re-renders the board every second. */
    const Display = () => {
      useNow();
      const { board } = useBoard(config);
      useEffect(() => {
        if (board !== undefined) fetchedAt.add(board.fetchedAt.getTime());
      }, [board]);
      return null;
    };

    const { unmount } = render(
      <QueryClientProvider client={client}>
        <Display />
      </QueryClientProvider>,
    );
    // Two poll intervals of 30 s ± 10 %, plus room for the first fetch — one second at a time,
    // each in its own act(), so React renders every tick as it does in the browser. Inside a
    // single act() the ticks would be batched and the re-renders this is about never happen.
    for (let second = 0; second < 70; second++) {
      await act(() => vi.advanceTimersByTimeAsync(1_000));
    }

    expect(fetchedAt.size).toBeGreaterThanOrEqual(3);
    unmount();
    client.clear();
  });
});

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A request that never answers, remembering the signal it was given. */
  const hanging = (seen: { signal?: AbortSignal }) => (signal: AbortSignal) => {
    seen.signal = signal;
    return new Promise<never>(() => undefined);
  };

  it('passes a result through', async () => {
    const parent = new AbortController();
    await expect(withTimeout(() => Promise.resolve('board'), parent.signal, 1_000)).resolves.toBe(
      'board',
    );
  });

  it('passes a failure through', async () => {
    const parent = new AbortController();
    const failing = () => Promise.reject(new Error('IRIS request failed: 503'));
    await expect(withTimeout(failing, parent.signal, 1_000)).rejects.toThrow('503');
  });

  it('gives up on a request that never answers, so the next poll can start', async () => {
    vi.useFakeTimers();
    const seen: { signal?: AbortSignal } = {};
    const pending = withTimeout(hanging(seen), new AbortController().signal, 10_000);
    const outcome = expect(pending).rejects.toThrow('did not finish within 10000 ms');

    await vi.advanceTimersByTimeAsync(9_999);
    expect(seen.signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await outcome;
    expect(seen.signal?.aborted).toBe(true);
  });

  it('follows an abort from the query and passes it on to the request', async () => {
    const parent = new AbortController();
    const seen: { signal?: AbortSignal } = {};
    const pending = withTimeout(hanging(seen), parent.signal, 10_000);

    parent.abort();
    await expect(pending).rejects.toThrow();
    expect(seen.signal?.aborted).toBe(true);
  });
});
