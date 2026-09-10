import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConfiguredClock, useNow } from './useClock';
import { ClockContext } from '@/app/ClockContext';
import { displayConfigSchema } from '@/app/config';
import { fixedClock, systemClock } from '@/platform/clock';
import type { ReactNode } from 'react';

const config = (overrides: Record<string, unknown> = {}) =>
  displayConfigSchema.parse({ station: '8000105', ...overrides });

describe('useConfiguredClock', () => {
  it('keeps the same clock instance across re-renders', () => {
    // The invariant that matters: an accelerated clock captures its origin when
    // constructed, so a rebuild on every render would reset the simulated time and
    // re-arm every interval that depends on the clock.
    const parsed = config({ simulatedTime: '2026-09-10T08:00:00+02:00', timeFactor: 60 });
    const { result, rerender } = renderHook(() => useConfiguredClock(parsed));
    const first = result.current;

    rerender();
    rerender();

    expect(result.current).toBe(first);
  });

  it('builds a new clock when the configuration changes', () => {
    // The other half of the contract: stability must not turn into staleness once the
    // configuration becomes editable at runtime.
    const first = config({ simulatedTime: '2026-09-10T08:00:00Z' });
    const second = config({ simulatedTime: '2026-09-10T20:00:00Z' });

    const { result, rerender } = renderHook(({ c }) => useConfiguredClock(c), {
      initialProps: { c: first },
    });
    const before = result.current;
    expect(before.now().toISOString()).toBe('2026-09-10T08:00:00.000Z');

    rerender({ c: second });

    expect(result.current).not.toBe(before);
    expect(result.current.now().toISOString()).toBe('2026-09-10T20:00:00.000Z');
  });

  it('uses real time when no time is simulated', () => {
    const { result } = renderHook(() => useConfiguredClock(config()));
    expect(result.current).toBe(systemClock);
  });

  it('falls back to real time when the configuration failed to parse', () => {
    const { result } = renderHook(() => useConfiguredClock(undefined));
    expect(result.current).toBe(systemClock);
  });

  it('freezes at the simulated instant when no factor is given', () => {
    const parsed = config({ simulatedTime: '2026-09-10T08:00:00Z' });
    const { result } = renderHook(() => useConfiguredClock(parsed));
    expect(result.current.now().toISOString()).toBe('2026-09-10T08:00:00.000Z');
  });
});

describe('useNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stands still while the clock is frozen, however long it ticks', () => {
    vi.useFakeTimers();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ClockContext.Provider value={fixedClock(new Date('2026-09-10T08:00:00Z'))}>
        {children}
      </ClockContext.Provider>
    );

    const { result } = renderHook(() => useNow(), { wrapper });
    expect(result.current.toISOString()).toBe('2026-09-10T08:00:00.000Z');

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    // Five ticks happened; the displayed time did not move, which is what the demo
    // mode is for.
    expect(result.current.toISOString()).toBe('2026-09-10T08:00:00.000Z');
  });
});
