import { useLayoutEffect, useRef, useState } from 'react';
import styles from './zza.module.css';
import type { ReactNode } from 'react';

export interface FittedTextProps {
  readonly children: ReactNode;
  /** Never squeeze narrower than this share of the natural width. */
  readonly minScale?: number;
}

/**
 * Squeezes its content horizontally when it is wider than its field — what a real display
 * does with a long station name, rather than cutting it off with an ellipsis.
 *
 * Below `minScale` the squeezing stops and the rest is clipped, because a name pressed
 * thinner than that is no longer readable from the platform. Squeezing is a transform, so
 * it changes no layout and the measurement stays stable across renders.
 */
export const FittedText = ({ children, minScale = 0.5 }: FittedTextProps) => {
  const field = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const fit = () => {
      const outer = field.current;
      const inner = content.current;
      if (outer === null || inner === null) return;
      const available = outer.clientWidth;
      const natural = inner.scrollWidth;
      if (available === 0 || natural === 0 || natural <= available) {
        setScale(1);
        return;
      }
      setScale(Math.max(minScale, available / natural));
    };

    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [children, minScale]);

  return (
    <span className={styles.fitted} ref={field}>
      <span
        className={styles.fittedContent}
        ref={content}
        data-scale={scale}
        style={scale < 1 ? { transform: `scaleX(${scale})` } : undefined}
      >
        {children}
      </span>
    </span>
  );
};
