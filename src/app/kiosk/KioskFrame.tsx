import { useEffect } from 'react';
import { isFullscreenKey, toggleFullscreen } from './fullscreen';
import styles from './KioskFrame.module.css';
import { useIdleCursor } from './useIdleCursor';
import { useReloadWhenStuck } from './useReloadWhenStuck';
import { useWakeLock } from './useWakeLock';
import type { ReactNode } from 'react';

export interface KioskFrameProps {
  /** The display's poll interval; the outage watchdog scales with it. */
  readonly refreshSeconds: number;
  readonly children: ReactNode;
}

/**
 * What a display needs to run unattended, around whatever design it shows: no scrollbars,
 * no resting cursor, no screen saver, fullscreen on "f" or a double-click, and a reload
 * after a long total outage.
 *
 * Always on rather than switched by a parameter: none of it gets in the way at a desk, and
 * a kiosk that forgot a flag is exactly the case it exists for.
 */
export const KioskFrame = ({ refreshSeconds, children }: KioskFrameProps) => {
  const idle = useIdleCursor();
  useWakeLock();
  useReloadWhenStuck({ refreshSeconds });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isFullscreenKey(event)) toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main
      className={styles.frame}
      // An attribute rather than a class, so controls on the display (the quick-switch
      // button) can fade out together with the cursor.
      data-idle={idle ? '' : undefined}
      onDoubleClick={toggleFullscreen}
    >
      {children}
    </main>
  );
};
