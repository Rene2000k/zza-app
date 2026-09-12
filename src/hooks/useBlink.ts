import { useEffect, useState } from 'react';

/**
 * Toggles on a fixed interval, for the blinking a real display uses on a cancellation or a
 * platform change.
 *
 * There is no way to switch it off: the point of the project is to reproduce the displays,
 * and a still cancellation notice is a different display. Starts visible, so a design that
 * renders while the first interval is still pending shows the notice rather than a gap.
 */
export const useBlink = (intervalMs: number): boolean => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handle = setInterval(() => setVisible((previous) => !previous), intervalMs);
    return () => clearInterval(handle);
  }, [intervalMs]);

  return visible;
};
