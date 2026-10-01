import { useEffect } from 'react';
import { isFullscreenKey, toggleFullscreen } from './fullscreen';
import styles from './KioskFrame.module.css';
import { useIdleCursor } from './useIdleCursor';
import { useWakeLock } from './useWakeLock';
import type { ReactNode } from 'react';

export interface KioskFrameProps {
  readonly children: ReactNode;
}

/**
 * What a display needs to run unattended, around whatever design it shows: no scrollbars,
 * no resting cursor, no screen saver, and fullscreen on "f" or a double-click.
 *
 * Always on rather than switched by a parameter: none of it gets in the way at a desk, and
 * a kiosk that forgot a flag is exactly the case it exists for.
 */
export const KioskFrame = ({ children }: KioskFrameProps) => {
  const idle = useIdleCursor();
  useWakeLock();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isFullscreenKey(event)) toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main
      className={idle ? `${styles.frame} ${styles.idle}` : styles.frame}
      onDoubleClick={toggleFullscreen}
    >
      {children}
    </main>
  );
};
