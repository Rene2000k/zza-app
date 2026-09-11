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
      provider.getBoard(
        {
          station: config.station,
          ...(config.platform === undefined ? {} : { platform: config.platform }),
          now: clock.now(),
          horizonMinutes: config.horizonMinutes,
        },
        signal,
      ),
    // A function, so TanStack Query asks again after every poll and the jitter is fresh.
    refetchInterval: () => jitteredIntervalMs(config.refreshSeconds),
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
