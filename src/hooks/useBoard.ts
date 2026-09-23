import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createProvider } from '@/providers/registry';
import { useClock } from './useClock';
import type { DisplayConfig } from '@/app/config';
import type { StationBoard } from '@/domain/board';

/**
 * Data counts as stale after this many poll intervals without a successful refresh. One
 * missed poll is ordinary (a retry, jitter); two in a row mean the source is not
 * answering, and a display may then say so.
 */
const STALE_AFTER_POLLS = 3;

/** Each poll interval is varied by up to this fraction, in either direction. */
const POLL_JITTER = 0.1;

/**
 * A board fetch still running after this long is given up. IRIS answers in well under a
 * second (ADR-0002), so this only ever ends a request that is not coming back.
 */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * The next poll interval: the configured one, varied by up to ±10 %.
 *
 * Displays opened at the same moment would otherwise poll the source in lockstep for as
 * long as they run. The value is drawn anew for every poll, so they drift apart.
 */
export const jitteredIntervalMs = (
  refreshSeconds: number,
  random: () => number = Math.random,
): number => Math.round(refreshSeconds * 1000 * (1 + (random() * 2 - 1) * POLL_JITTER));

/**
 * A number in [0, 1) that depends on `seed` alone: asked twice with the same seed, it gives
 * the same answer (one step of mulberry32).
 */
export const seededUnit = (seed: number): number => {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
};

/**
 * Runs `work` with a signal that aborts when `parent` does or once `timeoutMs` has passed,
 * and settles at that moment even if `work` ignores its signal.
 *
 * TanStack Query starts no new poll while the previous fetch is still running — it waits
 * for that one. A request that never answers would therefore freeze the display until it
 * is reloaded; bounded, it becomes an ordinary failure that the next poll recovers from.
 */
export const withTimeout = <T>(
  work: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal,
  timeoutMs: number,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    const settle = () => {
      clearTimeout(timer);
      parent.removeEventListener('abort', onParentAbort);
    };
    const onParentAbort = () => {
      settle();
      controller.abort(parent.reason);
      reject(asError(parent.reason, 'Board fetch was aborted'));
    };
    const timer = setTimeout(() => {
      settle();
      const error = new Error(`Board fetch did not finish within ${timeoutMs} ms`);
      controller.abort(error);
      reject(error);
    }, timeoutMs);

    if (parent.aborted) {
      onParentAbort();
      return;
    }
    parent.addEventListener('abort', onParentAbort, { once: true });
    work(controller.signal).then(
      (value) => {
        settle();
        resolve(value);
      },
      (error: unknown) => {
        settle();
        reject(asError(error, 'Board fetch failed'));
      },
    );
  });

const asError = (reason: unknown, fallback: string): Error =>
  reason instanceof Error ? reason : new Error(fallback);

/**
 * Fetches and refreshes the board for a configuration.
 *
 * The failure policy is the display's, not the network's: the last good board stays
 * in place when a fetch fails, so a dropout shows slightly old data instead of an
 * empty screen. When "slightly old" becomes worth saying out loud is set here, as
 * `staleAfterSeconds`; callers apply it with `isStale` against their own ticking time.
 */
export interface BoardState {
  readonly board: StationBoard | undefined;
  readonly isLoading: boolean;
  readonly error: Error | null;
  /** True while a refresh is in flight and previous data is still shown. */
  readonly isRefreshing: boolean;
  /** Data older than this counts as stale (see `isStale`). */
  readonly staleAfterSeconds: number;
}

export const useBoard = (config: DisplayConfig): BoardState => {
  const clock = useClock();
  const provider = useMemo(() => createProvider(config.provider), [config.provider]);

  const query = useQuery({
    queryKey: ['board', config.provider, config.station, config.platform, config.horizonMinutes],
    queryFn: ({ signal }) =>
      withTimeout(
        (bounded) =>
          provider.getBoard(
            {
              station: config.station,
              ...(config.platform === undefined ? {} : { platform: config.platform }),
              now: clock.now(),
              horizonMinutes: config.horizonMinutes,
            },
            bounded,
          ),
        signal,
        FETCH_TIMEOUT_MS,
      ),
    // TanStack Query asks for the interval on every render, not only after a poll, and
    // restarts its timer whenever the answer differs. A display re-renders every second, so a
    // freshly rolled value would restart the timer before it ever fired and polling would stop
    // after the first fetch. The jitter is therefore drawn from the time of the last result:
    // fixed between two polls, new after each one, and different for displays that fetched
    // at different moments.
    refetchInterval: (query) =>
      jitteredIntervalMs(config.refreshSeconds, () =>
        seededUnit(query.state.dataUpdatedAt + query.state.errorUpdatedAt),
      ),
    // Nobody brings a display back into view: it keeps polling while its window is hidden,
    // minimised or covered, where TanStack Query would otherwise pause.
    refetchIntervalInBackground: true,
    // Keep showing the previous board while refetching and on failure.
    placeholderData: (previous) => previous,
    // Backoff within a poll: TanStack Query retries after 1 s, then 2 s.
    retry: 2,
    staleTime: 0,
  });

  return {
    board: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isRefreshing: query.isFetching && query.data !== undefined,
    staleAfterSeconds: STALE_AFTER_POLLS * config.refreshSeconds,
  };
};
