import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KioskFrame } from './KioskFrame';
import { isFullscreenKey } from './fullscreen';
import { CURSOR_IDLE_MS } from './useIdleCursor';
import { useWakeLock } from './useWakeLock';

describe('kiosk frame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides the cursor once the pointer rests, and shows it on movement', () => {
    render(
      <KioskFrame>
        <p>Anzeige</p>
      </KioskFrame>,
    );
    const frame = screen.getByRole('main');
    const restingClass = frame.className;

    act(() => {
      vi.advanceTimersByTime(CURSOR_IDLE_MS);
    });
    expect(frame.className).not.toBe(restingClass);

    fireEvent.pointerMove(window);
    expect(frame.className).toBe(restingClass);
  });
});

describe('fullscreen key', () => {
  it('is a plain "f", not a browser shortcut', () => {
    expect(isFullscreenKey(new KeyboardEvent('keydown', { key: 'f' }))).toBe(true);
    expect(isFullscreenKey(new KeyboardEvent('keydown', { key: 'F' }))).toBe(true);
    expect(isFullscreenKey(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))).toBe(false);
    expect(isFullscreenKey(new KeyboardEvent('keydown', { key: 'g' }))).toBe(false);
  });
});

describe('wake lock', () => {
  const request = vi.fn<(type: 'screen') => Promise<WakeLockSentinel>>();
  const release = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    const sentinel: WakeLockSentinel = Object.assign(new EventTarget(), {
      released: false,
      type: 'screen' as const,
      onrelease: null,
      release,
    });
    request.mockReset().mockResolvedValue(sentinel);
    release.mockClear();
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('holds the screen awake and asks again when the page comes back into view', async () => {
    const { unmount } = renderHook(() => useWakeLock());
    expect(request).toHaveBeenCalledWith('screen');

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(2);

    unmount();
    expect(release).toHaveBeenCalled();
  });

  it('does nothing where the browser has no wake lock', () => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    expect(() => renderHook(() => useWakeLock())).not.toThrow();
  });
});
