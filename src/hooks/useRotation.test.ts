import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRotation } from './useRotation';

afterEach(() => {
  vi.useRealTimers();
});

describe('useRotation', () => {
  it('shows the first item and moves on with each interval', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRotation(['via', 'meldung', 'hinweis'], 1_000));
    expect(result.current).toBe('via');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe('meldung');

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    // Back at the start: the cycle wraps rather than running out.
    expect(result.current).toBe('via');
  });

  it('starts no timer for a single item', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRotation(['via'], 1_000));
    expect(result.current).toBe('via');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('yields nothing for an empty list', () => {
    const { result } = renderHook(() => useRotation([], 1_000));
    expect(result.current).toBeUndefined();
  });

  it('keeps its position when the list is replaced by an equally long one', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ items }) => useRotation(items, 1_000), {
      initialProps: { items: ['a', 'b'] },
    });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe('b');

    // What every poll does: same shape, fresh objects.
    rerender({ items: ['a', 'b'] });
    expect(result.current).toBe('b');
  });
});
