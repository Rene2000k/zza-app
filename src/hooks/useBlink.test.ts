import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBlink } from './useBlink';

afterEach(() => {
  vi.useRealTimers();
});

describe('useBlink', () => {
  it('starts visible and toggles on every interval', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBlink(500));
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);
  });

  it('stops its timer when the component goes away', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useBlink(500));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
