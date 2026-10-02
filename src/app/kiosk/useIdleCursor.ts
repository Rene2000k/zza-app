import { useEffect, useState } from 'react';

/** How long the pointer has to rest before it is hidden. */
export const CURSOR_IDLE_MS = 3000;

/**
 * True once the pointer has not moved for a while, or has left the window.
 *
 * A display has nobody pointing at it; a cursor parked in the middle of the picture is
 * a flaw, not a feature. It comes back on the first movement. The timer starts at mount,
 * so on a kiosk whose mouse never moves the cursor is gone after the first few seconds.
 *
 * Leaving the window counts at once: whoever moved the mouse away is done with the display,
 * and controls that fade with the cursor should not linger for the rest of the timeout.
 */
export const useIdleCursor = (idleMs = CURSOR_IDLE_MS): boolean => {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), idleMs);
    const onMove = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), idleMs);
    };
    // `pointerout` fires for every element boundary; only a missing related target means
    // the pointer went outside the page.
    const onOut = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return;
      clearTimeout(timer);
      setIdle(true);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerout', onOut);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
    };
  }, [idleMs]);

  return idle;
};
