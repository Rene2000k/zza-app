import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useZzaBoard } from './useZzaBoard';
import { ClockContext } from '@/app/ClockContext';
import { displayConfigSchema } from '@/app/config';
import { fixedClock, manualClock } from '@/platform/clock';
import type { ReactNode } from 'react';
import type { Clock } from '@/platform/clock';

/** Provider → domain model → view model, with a frozen clock so the split is exact. */
const renderBoard = (
  overrides: Record<string, unknown> = {},
  clock: Clock = fixedClock(new Date('2026-09-09T08:00:00+02:00')),
) => {
  const config = displayConfigSchema.parse({ station: '8000105', provider: 'mock', ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ClockContext.Provider value={clock}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ClockContext.Provider>
  );

  return renderHook(() => useZzaBoard(config), { wrapper });
};

describe('useZzaBoard', () => {
  it('is loading until the first board arrives', async () => {
    const { result } = renderBoard();
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('ready'));
  });

  it('makes the next train the current one and the rest the following ones', async () => {
    const { result } = renderBoard({ platform: '9' });
    await waitFor(() => expect(result.current.state).toBe('ready'));

    const board = result.current;
    if (board.state !== 'ready') throw new Error('expected a ready board');
    expect(board.station.name).toBe('Frankfurt(Main)Hbf');
    expect(board.platform).toBe('9');
    expect(board.current?.id).toBe('mock-ice-571');
    // In time order, and without the current train appearing again.
    const times = board.following.map((entry) => entry.time.expected.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(board.following.some((entry) => entry.id === 'mock-ice-571')).toBe(false);
  });

  it('offers the current train’s resolved messages for a running line', async () => {
    const { result } = renderBoard({ platform: '12' });
    await waitFor(() => expect(result.current.state).toBe('ready'));

    const board = result.current;
    if (board.state !== 'ready') throw new Error('expected a ready board');
    expect(board.current?.id).toBe('mock-re-4168');
    expect(board.messages.map((message) => message.text)).toEqual([
      'Verspätung eines vorausfahrenden Zuges',
    ]);
  });

  it('sets the second part of a coupled main train beside it, not among the following trains', async () => {
    const { result } = renderBoard({ platform: '15' });
    await waitFor(() => expect(result.current.state).toBe('ready'));

    const board = result.current;
    if (board.state !== 'ready') throw new Error('expected a ready board');
    expect(board.current?.id).toBe('mock-hlb-15012');
    expect(board.secondPart?.id).toBe('mock-hlb-15112');
    // ICE 847 goes the same way as ICE 857 and is not listed at all (ADR-0014).
    expect(board.following.map((entry) => entry.id)).toEqual(['mock-ice-857']);
  });

  it('has no second part for a train that runs alone', async () => {
    const { result } = renderBoard({ platform: '9' });
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.state === 'ready' && result.current.secondPart).toBeUndefined();
  });

  it('reports the data as stale once it is older than three poll intervals', async () => {
    const clock = manualClock(new Date('2026-09-09T08:00:00+02:00'));
    const { result } = renderBoard({}, clock);
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.state === 'ready' && result.current.stale).toBe(false);

    clock.advance(91_000);
    await waitFor(() =>
      expect(result.current.state === 'ready' && result.current.stale).toBe(true),
    );
    expect(result.current.state === 'ready' && result.current.dataAgeSeconds).toBe(91);
  });
});
