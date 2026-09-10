import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClockContext } from './ClockContext';
import { SmokeBoard } from './SmokeBoard';
import { parseConfig } from './config';
import { acceleratedClock, fixedClock, systemClock } from '@/platform/clock';
import type { Clock } from '@/platform/clock';
import type { DisplayConfig } from './config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A display is never "focused"; refreshing is driven by the poll interval alone.
      refetchOnWindowFocus: false,
    },
  },
});

/** Default display when no configuration is given: Frankfurt Hbf, platform 9, mock data. */
const fallbackSearch = 'station=8000105&platform=9&provider=mock';

export const App = () => {
  const result = useMemo(
    () => parseConfig(window.location.search === '' ? fallbackSearch : window.location.search),
    [],
  );

  if (!result.ok) {
    return (
      <main>
        <h1>Konfiguration ungültig</h1>
        <ul>
          {result.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
        <p>
          Beispiel: <code>?station=8000105&amp;platform=9&amp;provider=mock</code>
        </p>
      </main>
    );
  }

  return (
    <ClockContext.Provider value={clockFor(result.config)}>
      <QueryClientProvider client={queryClient}>
        <main>
          <SmokeBoard config={result.config} />
        </main>
      </QueryClientProvider>
    </ClockContext.Provider>
  );
};

/**
 * Builds the clock the configuration asks for (ADR-0004): real time, a frozen
 * instant, or an accelerated run starting at that instant.
 */
const clockFor = (config: DisplayConfig): Clock => {
  if (config.simulatedTime === undefined) return systemClock;
  const start = new Date(config.simulatedTime);
  return config.timeFactor === undefined ? fixedClock(start) : acceleratedClock(start, config.timeFactor);
};
