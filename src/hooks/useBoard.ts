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
    refetchInterval: config.refreshSeconds * 1000,
    // Keep showing the previous board while refetching and on failure.
    placeholderData: (previous) => previous,
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
