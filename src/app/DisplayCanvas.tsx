import { useLayoutEffect, useRef, useState } from 'react';
import styles from './DisplayCanvas.module.css';
import type { ReactNode } from 'react';

export interface DisplayCanvasProps {
  /** Native resolution of the display being reproduced. */
  readonly canvas: { readonly width: number; readonly height: number };
  readonly children: ReactNode;
}

/**
 * Puts a design's native canvas onto whatever screen it runs on.
 *
 * The design draws at the real resolution of the hardware it reproduces and the whole
 * picture is scaled from here, keeping the aspect ratio and letterboxing the remainder.
 * That is what allows a design to think in fixed pixels — the alternative, every design
 * doing its own relative sizing, is exactly what makes a replica stop being one.
 */
export const DisplayCanvas = ({ canvas, children }: DisplayCanvasProps) => {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const fit = () => {
      const element = frame.current;
      if (element === null) return;
      const { clientWidth, clientHeight } = element;
      // Before layout — and under jsdom — the frame has no size; keep the last scale
      // instead of collapsing the display to nothing.
      if (clientWidth === 0 || clientHeight === 0) return;
      setScale(Math.min(clientWidth / canvas.width, clientHeight / canvas.height));
    };

    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [canvas.width, canvas.height]);

  return (
    <div className={styles.frame} ref={frame}>
      <div
        className={styles.canvas}
        data-scale={scale}
        style={{ width: canvas.width, height: canvas.height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
};
