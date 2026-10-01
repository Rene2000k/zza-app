import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClockContext } from './ClockContext';
import { DesignHost } from './DesignHost';
import styles from './App.module.css';
import { parseConfig } from './config';
import { KioskFrame } from './kiosk/KioskFrame';
import { useConfiguredClock } from '@/hooks/useClock';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A display is never "focused"; refreshing is driven by the poll interval alone.
      refetchOnWindowFocus: false,
    },
  },
});

/** The setup page next to this display, carrying the current query so the form starts from it. */
const setupHref = (): string =>
  `${window.location.pathname.replace(/\/?$/, '/')}setup${window.location.search}`;

export const App = () => {
  // Only reached with a query: without one, the root shows the setup page instead.
  const result = useMemo(() => parseConfig(window.location.search), []);
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
        <p>
          <a href={setupHref()}>Zur Einrichtung</a>
        </p>
      </main>
    );
  }

  return (
    <ClockContext.Provider value={clock}>
      <QueryClientProvider client={queryClient}>
        <KioskFrame>
          <DesignHost config={result.config} />
        </KioskFrame>
      </QueryClientProvider>
    </ClockContext.Provider>
  );
};
