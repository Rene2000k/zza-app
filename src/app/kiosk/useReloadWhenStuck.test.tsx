import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_OUTAGE_MS, PROBE_RETRY_MS, useReloadWhenStuck } from './useReloadWhenStuck';
import type { ReactNode } from 'react';

const withQueryClient = (client: QueryClient) =>
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe('reload after a total outage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (probe: () => Promise<boolean>, refreshSeconds = 30) => {
    const client = new QueryClient();
    const reload = vi.fn();
    renderHook(() => useReloadWhenStuck({ refreshSeconds, reload, probe }), {
      wrapper: withQueryClient(client),
    });
    return { client, reload };
  };

  it('reloads when no board has arrived for the outage time and the page is reachable', async () => {
    const { reload } = setup(() => Promise.resolve(true));

    await act(() => vi.advanceTimersByTimeAsync(MIN_OUTAGE_MS - 1));
    expect(reload).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('starts counting again with every successful board fetch', async () => {
    const { client, reload } = setup(() => Promise.resolve(true));

    await act(() => vi.advanceTimersByTimeAsync(MIN_OUTAGE_MS - 1000));
    act(() => {
      client.setQueryData(['board', 'mock', '8000105'], { entries: [] });
    });
    await act(() => vi.advanceTimersByTimeAsync(MIN_OUTAGE_MS - 1000));
    expect(reload).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('ignores successes of other queries', async () => {
    const { client, reload } = setup(() => Promise.resolve(true));

    await act(() => vi.advanceTimersByTimeAsync(MIN_OUTAGE_MS - 1000));
    act(() => {
      client.setQueryData(['station', 'mock', '8000105'], null);
    });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('keeps the stale display while its own server is unreachable, and asks again', async () => {
    const probe = vi
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const { reload } = setup(probe);

    await act(() => vi.advanceTimersByTimeAsync(MIN_OUTAGE_MS));
    expect(reload).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(PROBE_RETRY_MS));
    expect(reload).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(PROBE_RETRY_MS));
    expect(reload).toHaveBeenCalledOnce();
    expect(probe).toHaveBeenCalledTimes(3);
  });

  it('waits for several missed polls when polling is slow', async () => {
    const { reload } = setup(() => Promise.resolve(true), 600);

    await act(() => vi.advanceTimersByTimeAsync(MIN_OUTAGE_MS));
    expect(reload).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(5 * 600_000 - MIN_OUTAGE_MS));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('counts a real board query as success', async () => {
    const client = new QueryClient();
    const reload = vi.fn();
    renderHook(
      () => {
        useReloadWhenStuck({ refreshSeconds: 30, reload, probe: () => Promise.resolve(true) });
        useQuery({
          queryKey: ['board'],
          queryFn: () => Promise.resolve(1),
          refetchInterval: 60_000,
        });
      },
      { wrapper: withQueryClient(client) },
    );

    await act(() => vi.advanceTimersByTimeAsync(3 * MIN_OUTAGE_MS));
    expect(reload).not.toHaveBeenCalled();
  });
});
