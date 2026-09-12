import { useLayoutEffect, useRef, useState } from 'react';
import styles from './zza.module.css';
import type { ReactNode } from 'react';

export interface MarqueeProps {
  readonly children: ReactNode;
  /** Travel in canvas pixels per second — a design's own pixels, before the app scales them. */
  readonly speed?: number;
  /** Distance between the end of the content and the copy following it. */
  readonly gap?: number;
}

/**
 * Scrolls its content when, and only when, it is too wide for its field — the way a real
 * display leaves a short message standing and runs a long one.
 *
 * The loop is seamless because the content is rendered twice: the track travels exactly the
 * width of one copy plus the gap, at which point the copy stands where the original began.
 * The travel is handed to the browser as one animation instead of being stepped from
 * JavaScript, so a running line costs no frame work and cannot thrash layout.
 */
export const Marquee = ({ children, speed = 60, gap = 48 }: MarqueeProps) => {
  const field = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const outer = field.current;
      const inner = content.current;
      if (outer === null || inner === null) return;
      const overflows = inner.scrollWidth > outer.clientWidth;
      setDistance(overflows ? inner.scrollWidth + gap : 0);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [children, gap]);

  useLayoutEffect(() => {
    const element = track.current;
    // Web Animations is missing in jsdom; without it the line simply stands still.
    if (element === null || distance <= 0 || typeof element.animate !== 'function') return;

    const animation = element.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${-distance}px)` }],
      { duration: (distance / speed) * 1000, iterations: Infinity, easing: 'linear' },
    );
    return () => animation.cancel();
  }, [distance, speed]);

  const scrolling = distance > 0;
  return (
    <div className={styles.marquee} ref={field} data-scrolling={scrolling}>
      <div className={styles.marqueeTrack} ref={track}>
        <span ref={content}>{children}</span>
        {scrolling ? (
          <span aria-hidden="true" style={{ paddingInlineStart: `${gap}px` }}>
            {children}
          </span>
        ) : null}
      </div>
    </div>
  );
};
