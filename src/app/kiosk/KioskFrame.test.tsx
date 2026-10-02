import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
      <QueryClientProvider client={new QueryClient()}>
        <KioskFrame refreshSeconds={30}>
          <p>Anzeige</p>
        </KioskFrame>
      </QueryClientProvider>,
    );
    const frame = screen.getByRole('main');
    expect(frame.hasAttribute('data-idle')).toBe(false);

    act(() => {
      vi.advanceTimersByTime(CURSOR_IDLE_MS);
    });
    expect(frame.hasAttribute('data-idle')).toBe(true);

    fireEvent.pointerMove(window);
    expect(frame.hasAttribute('data-idle')).toBe(false);
  });

  it('counts the pointer leaving the window as idle at once, but not moving between elements', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <KioskFrame refreshSeconds={30}>
          <p>Anzeige</p>
        </KioskFrame>
      </QueryClientProvider>,
    );
    const frame = screen.getByRole('main');
    fireEvent.pointerMove(window);

    fireEvent.pointerOut(frame, { relatedTarget: screen.getByText('Anzeige') });
    expect(frame.hasAttribute('data-idle')).toBe(false);

    fireEvent.pointerOut(frame, { relatedTarget: null });
    expect(frame.hasAttribute('data-idle')).toBe(true);

    fireEvent.pointerMove(window);
    expect(frame.hasAttribute('data-idle')).toBe(false);
  });
});

describe('fullscreen key', () => {
  it('is a plain "f", not a browser shortcut', () => {
    expect(isFullscreenKey(new KeyboardEvent('keydown', { key: 'f' }))).toBe(true);
    expect(isFullscreenKey(new KeyboardEvent('keydown', { key: 'F' }))).toBe(true);
    expect(isFullscreenKey(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))).toBe(false);
    expect(isFullscreenKey(new KeyboardEvent('keydown', { key: 'g' }))).toBe(false);
  });

  it('is ignored while typing into a field', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const typed = new KeyboardEvent('keydown', { key: 'f', bubbles: true });
    let result: boolean | undefined;
    window.addEventListener('keydown', (event) => (result = isFullscreenKey(event)), {
      once: true,
    });
    input.dispatchEvent(typed);
    expect(result).toBe(false);
    input.remove();
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
