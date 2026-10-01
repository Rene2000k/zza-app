import { useEffect } from 'react';
import { matchQuery, useQueryClient } from '@tanstack/react-query';
import { useDiagnosticsLog } from '../diagnostics/DiagnosticsContext';
import { formatDuration } from '../diagnostics/diagnosticsLog';

/** No successful board fetch for this long counts as a total outage. */
export const MIN_OUTAGE_MS = 10 * 60_000;

/** At slow poll rates, an outage is only declared after this many missed polls. */
const OUTAGE_POLLS = 5;

/** While the page's own server is unreachable, it is asked again this often. */
export const PROBE_RETRY_MS = 60_000;

export interface ReloadWhenStuckOptions {
  readonly refreshSeconds: number;
  /** Replaced in tests; reloads the page. */
  readonly reload?: () => void;
  /** Replaced in tests; true when the page could be loaded again right now. */
  readonly probe?: () => Promise<boolean>;
}

/**
 * Reloads the page after a long total outage — the last resort of a display nobody tends.
 *
 * Ordinary dropouts need none of this: polling carries on by itself and the next good
 * answer replaces the stale board. A reload is for the case where that has not happened
 * for a long time and the page itself may be the problem — a state no poll can clear, or a
 * deployment it has not picked up.
 *
 * Before reloading, the page's own address is fetched. If that fails too, the network is
 * down, and a reload now would replace a stale but working display with the browser's
 * error page, which never recovers on its own. The probe is then repeated every minute.
 *
 * Success is read from the query cache instead of from the board hook, so the watchdog adds
 * no second poller to the board query.
 */
export const useReloadWhenStuck = ({
  refreshSeconds,
  // Module-level defaults on purpose: they are effect dependencies, and a fresh function
  // per render would re-arm the timer on every render, so it would never fire.
  reload = reloadPage,
  probe = probePage,
}: ReloadWhenStuckOptions): void => {
  const queryClient = useQueryClient();
  const log = useDiagnosticsLog();
  const outageMs = Math.max(MIN_OUTAGE_MS, OUTAGE_POLLS * refreshSeconds * 1000);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    // Logged once per outage, not on every retry: a night offline would otherwise fill the log.
    let deferralLogged = false;

    const defer = () => {
      if (!active) return;
      if (!deferralLogged) {
        log?.note('warn', 'Neuladen aufgeschoben: eigene Seite nicht erreichbar');
        deferralLogged = true;
      }
      timer = setTimeout(tryReload, PROBE_RETRY_MS);
    };
    const tryReload = () => {
      probe().then((reachable) => {
        if (!active) return;
        if (!reachable) {
          defer();
          return;
        }
        // The console line is what survives the reload; the in-memory log does not.
        log?.note('warn', `Neu geladen: seit ${formatDuration(outageMs)} keine Daten`);
        reload();
      }, defer);
    };
    const arm = () => {
      deferralLogged = false;
      clearTimeout(timer);
      timer = setTimeout(tryReload, outageMs);
    };

    arm();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'success' &&
        matchQuery({ queryKey: ['board'] }, event.query)
      ) {
        arm();
      }
    });
    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient, log, outageMs, reload, probe]);
};

const reloadPage = () => window.location.reload();

const probePage = async (): Promise<boolean> => {
  const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
  return response.ok;
};
