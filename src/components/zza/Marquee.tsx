import { useLayoutEffect, useRef, useState } from 'react';
import styles from './zza.module.css';
import type { ReactNode } from 'react';

export interface MarqueeProps {
  readonly children: ReactNode;
  /** Travel in canvas pixels per second — a design's own pixels, before the app scales them. */
  readonly speed?: number;
  /**
   * What stands between the end of the content and the copy following it: a distance in
   * canvas pixels, or text — a line that ends on its own separator continues with exactly the
   * separator's space, set in the display's font.
   */
  readonly gap?: number | string;
  /**
   * Text that ends the content only while it runs — a separator, so the next round reads like
   * any other join. Content that stands still stays bare. It does not count towards whether
   * the content fits.
   */
  readonly closing?: string;
}

/**
 * Scrolls its content when, and only when, it is too wide for its field — the way a real
 * display leaves a short message standing and runs a long one.
 *
 * The loop is seamless because the content is rendered twice: the track travels exactly the
 * distance from the original to the copy, at which point the copy stands where the original
 * began. That distance is measured rather than added up, so a gap given as text counts with
 * the width the font gives it. The travel is handed to the browser as one animation instead
 * of being stepped from JavaScript, so a running line costs no frame work and cannot thrash
 * layout.
 */
export const Marquee = ({ children, speed = 60, gap = 48, closing }: MarqueeProps) => {
  const field = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLSpanElement>(null);
  const copy = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [scrolling, setScrolling] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const outer = field.current;
      const inner = content.current;
      if (outer === null || inner === null) return;
      setScrolling(inner.scrollWidth > outer.clientWidth);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [children]);

  useLayoutEffect(() => {
    const element = track.current;
    const original = content.current;
    const repeat = copy.current;
    // Web Animations is missing in jsdom; without it the line simply stands still.
    if (element === null || original === null || repeat === null) return;
    if (typeof element.animate !== 'function') return;

    const distance = repeat.offsetLeft - original.offsetLeft;
    const animation = element.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${-distance}px)` }],
      { duration: (distance / speed) * 1000, iterations: Infinity, easing: 'linear' },
    );
    return () => animation.cancel();
  }, [scrolling, children, gap, closing, speed]);

  return (
    <div className={styles.marquee} ref={field} data-scrolling={scrolling}>
      <div className={styles.marqueeTrack} ref={track}>
        <span ref={content}>{children}</span>
        {/* Its own box, so its leading space would collapse without `pre`. */}
        {scrolling && closing !== undefined ? (
          <span style={{ whiteSpace: 'pre' }}>{closing}</span>
        ) : null}
        {scrolling ? (
          <span
            aria-hidden="true"
            ref={copy}
            style={typeof gap === 'number' ? { paddingInlineStart: `${gap}px` } : {}}
          >
            {/* Kept as written: a space alone at the start of a line would otherwise collapse. */}
            {typeof gap === 'string' ? <span style={{ whiteSpace: 'pre' }}>{gap}</span> : null}
            {children}
            {closing}
          </span>
        ) : null}
      </div>
    </div>
  );
};
