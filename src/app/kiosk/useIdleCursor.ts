import { useEffect, useState } from 'react';

/** How long the pointer has to rest before it is hidden. */
export const CURSOR_IDLE_MS = 3000;

/**
 * True once the pointer has not moved for a while.
 *
 * A display has nobody pointing at it; a cursor parked in the middle of the picture is
 * a flaw, not a feature. It comes back on the first movement. The timer starts at mount,
 * so on a kiosk whose mouse never moves the cursor is gone after the first few seconds.
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

    window.addEventListener('pointermove', onMove);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
    };
  }, [idleMs]);

  return idle;
};
