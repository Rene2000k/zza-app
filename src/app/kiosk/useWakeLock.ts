import { useEffect } from 'react';

/**
 * Keeps the screen from dimming or locking while the display is shown.
 *
 * Best effort by nature: the Screen Wake Lock API exists only in secure contexts (HTTPS or
 * localhost), and the browser may refuse or drop the lock — on low battery, or whenever the
 * page is hidden. A dropped lock is requested again when the page becomes visible. Where
 * there is no API, the screen saver has to be switched off in the operating system.
 */
export const useWakeLock = (): void => {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | undefined;
    let active = true;

    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then(
        (lock) => {
          if (active) sentinel = lock;
          else void lock.release();
        },
        // Refused (not allowed, battery saver): nothing to do but try again on the next
        // visibility change. The display itself is unaffected.
        () => undefined,
      );
    };
    const onVisibility = () => acquire();

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
    };
  }, []);
};
