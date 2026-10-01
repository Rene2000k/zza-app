import { useEffect, useState } from 'react';
import { matchQuery, useQueryClient } from '@tanstack/react-query';
import { DiagnosticsContext } from './DiagnosticsContext';
import { createDiagnosticsLog } from './diagnosticsLog';
import type { DiagnosticsLog } from './diagnosticsLog';
import type { DisplayConfig } from '../config';
import type { ReactNode } from 'react';

export interface DiagnosticsProps {
  readonly config: DisplayConfig;
  /** Replaced in tests; a fresh log writing to the console otherwise. */
  readonly log?: DiagnosticsLog;
  readonly children: ReactNode;
}

/**
 * Records what happens to a running display into its diagnostics log and hands the log to
 * everything below.
 *
 * Board results are read from the query cache — one entry per poll, after its retries —
 * rather than from the board hook, so recording adds no second poller. The browser's
 * offline/online events are logged too: while offline, TanStack Query pauses polling
 * instead of failing, so without them an outage would leave no trace at all.
 */
export const Diagnostics = ({ config, log: given, children }: DiagnosticsProps) => {
  const [log] = useState(() => given ?? createDiagnosticsLog());
  const queryClient = useQueryClient();

  useEffect(() => {
    log.note('info', `Anzeige gestartet: ${describeConfig(config)}`);
  }, [log, config]);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || !matchQuery({ queryKey: ['board'] }, event.query)) return;
      if (event.action.type === 'success') log.boardSucceeded();
      if (event.action.type === 'error') log.boardFailed(event.action.error);
    });
    const onOffline = () => log.note('warn', 'Browser meldet: offline');
    const onOnline = () => log.note('info', 'Browser meldet: wieder online');
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      unsubscribe();
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [log, queryClient]);

  return <DiagnosticsContext.Provider value={log}>{children}</DiagnosticsContext.Provider>;
};

const describeConfig = (config: DisplayConfig): string =>
  [
    `Bahnhof ${config.station}`,
    config.platform === undefined ? 'alle Gleise' : `Gleis ${config.platform}`,
    `Design ${config.design}`,
    `Quelle ${config.provider}`,
    `alle ${config.refreshSeconds} s`,
  ].join(', ');
