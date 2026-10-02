import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { designIds } from '@/designs/registry';
import { providerIds } from '@/providers/registry';
import { displayConfigSchema, parseConfig, toSearch } from '../config';
import { ConfigFields } from './ConfigFields';
import { fieldParams } from './configFieldValues';
import styles from './Setup.module.css';
import type { ConfigFieldValues } from './configFieldValues';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

/** The source a new display is set up with unless the link says otherwise: the real one. */
const DEFAULT_PROVIDER = 'iris';

/**
 * The setup page, at `/setup`: station, platform and design in, a display link out.
 *
 * The link is the configuration — the page holds nothing of its own and stores nothing,
 * it only writes the query the display reads. Every value goes through the display's own
 * parser, so what the page accepts is exactly what the display will accept.
 *
 * Opened with a query (e.g. from the display's error page), the form starts from it.
 */
export const Setup = () => (
  <QueryClientProvider client={queryClient}>
    <SetupForm />
  </QueryClientProvider>
);

const SetupForm = () => {
  const [initial] = useState(() => new URLSearchParams(window.location.search));
  const defaults = displayConfigSchema.shape;

  const [fields, setFields] = useState<ConfigFieldValues>(() => {
    const requested = initial.get('provider');
    return {
      station: initial.get('station') ?? '',
      platform: initial.get('platform') ?? '',
      design: initial.get('design') ?? designIds()[0] ?? '',
      provider:
        requested !== null && providerIds().includes(requested) ? requested : DEFAULT_PROVIDER,
    };
  });
  const [refreshSeconds, setRefreshSeconds] = useState(
    initial.get('refreshSeconds') ?? String(defaults.refreshSeconds.parse(undefined)),
  );
  const [horizonMinutes, setHorizonMinutes] = useState(
    initial.get('horizonMinutes') ?? String(defaults.horizonMinutes.parse(undefined)),
  );

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = (text: string) => {
    // The clipboard API exists only in secure contexts; a display host reached over plain
    // HTTP in the local network has none, and the selectable field is the fallback.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(text))
      .then(
        () => setCopyState('copied'),
        () => setCopyState('failed'),
      );
  };

  const result = parseConfig(
    new URLSearchParams({ ...fieldParams(fields), refreshSeconds, horizonMinutes }).toString(),
  );
  const link = result.ok ? displayUrl(toSearch(result.config)) : undefined;

  return (
    <main className={styles.page}>
      <h1>Anzeige einrichten</h1>

      <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <ConfigFields idPrefix="setup" values={fields} onChange={setFields} />

        <label htmlFor="setup-refresh">Abrufintervall (s)</label>
        <input
          id="setup-refresh"
          type="number"
          min={10}
          max={600}
          value={refreshSeconds}
          onChange={(event) => setRefreshSeconds(event.target.value)}
        />

        <label htmlFor="setup-horizon">Vorschau (min)</label>
        <input
          id="setup-horizon"
          type="number"
          min={5}
          max={360}
          value={horizonMinutes}
          onChange={(event) => setHorizonMinutes(event.target.value)}
        />
      </form>

      {link !== undefined ? (
        <section className={styles.result} aria-label="Link zur Anzeige">
          <input
            readOnly
            aria-label="Link"
            value={link}
            onFocus={(event) => event.target.select()}
          />
          <div className={styles.actions}>
            <a href={link}>Anzeige öffnen</a>
            <button type="button" onClick={() => copy(link)}>
              Link kopieren
            </button>
            <span className={styles.hint} aria-live="polite">
              {copyState === 'copied' ? 'Kopiert.' : null}
              {copyState === 'failed' ? 'Kopieren nicht möglich — bitte den Link markieren.' : null}
            </span>
          </div>
        </section>
      ) : (
        <ul className={styles.problems} aria-label="Noch unvollständig">
          {result.ok ? null : result.problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}
    </main>
  );
};

/** The display lives next to this page: same path, minus the trailing `setup`. */
const displayUrl = (search: string): string => {
  const path = window.location.pathname.replace(/setup\/?$/, '');
  return `${window.location.origin}${path}?${search}`;
};
