import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClockContext } from './ClockContext';
import { DesignHost } from './DesignHost';
import styles from './App.module.css';
import { parseConfig } from './config';
import { useConfiguredClock } from '@/hooks/useClock';

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
  // Called before the early return so the hook order stays the same on every render.
  const clock = useConfiguredClock(result.ok ? result.config : undefined);

  if (!result.ok) {
    return (
      <main className={styles.problems}>
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
    <ClockContext.Provider value={clock}>
      <QueryClientProvider client={queryClient}>
        <main className={styles.display}>
          <DesignHost config={result.config} />
        </main>
      </QueryClientProvider>
    </ClockContext.Provider>
  );
};
