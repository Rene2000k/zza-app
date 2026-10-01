import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { designIds, findDesign } from '@/designs/registry';
import { useStationLookup } from '@/hooks/useStationLookup';
import type { StationLookup } from '@/hooks/useStationLookup';
import { createProvider, providerIds } from '@/providers/registry';
import { displayConfigSchema, parseConfig, toSearch } from '../config';
import styles from './Setup.module.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const providers = providerIds().map((id) => ({ id, name: createProvider(id).name }));

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

  const [station, setStation] = useState(initial.get('station') ?? '');
  const [platform, setPlatform] = useState(initial.get('platform') ?? '');
  const [design, setDesign] = useState(initial.get('design') ?? designIds()[0] ?? '');
  const [provider, setProvider] = useState(() => {
    const requested = initial.get('provider');
    return requested !== null && providerIds().includes(requested) ? requested : DEFAULT_PROVIDER;
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

  const trimmedStation = station.trim();
  const trimmedPlatform = platform.trim();
  const lookup = useStationLookup(provider, trimmedStation);

  const result = parseConfig(
    new URLSearchParams({
      station: trimmedStation,
      ...(trimmedPlatform === '' ? {} : { platform: trimmedPlatform }),
      design,
      provider,
      refreshSeconds,
      horizonMinutes,
    }).toString(),
  );
  const link = result.ok ? displayUrl(toSearch(result.config)) : undefined;
  const canvas = findDesign(design)?.canvas;

  return (
    <main className={styles.page}>
      <h1>Anzeige einrichten</h1>

      <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="setup-station">Bahnhof (EVA-Nummer)</label>
        <div>
          <input
            id="setup-station"
            inputMode="numeric"
            placeholder="z. B. 8000105"
            value={station}
            onChange={(event) => setStation(event.target.value)}
          />
          <p className={styles.hint} aria-live="polite">
            {stationHint(lookup)}
          </p>
        </div>

        <label htmlFor="setup-platform">Gleis</label>
        <div>
          <input
            id="setup-platform"
            list="setup-platforms"
            placeholder="leer = alle Gleise"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          />
          <datalist id="setup-platforms">
            {/* IRIS reports platforms in no useful order ("22|23|24|1a|10|…"); a form sorts them. */}
            {lookup.station?.platforms.toSorted(byPlatformLabel).map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </div>

        <label htmlFor="setup-design">Design</label>
        <div>
          <select
            id="setup-design"
            value={design}
            onChange={(event) => setDesign(event.target.value)}
          >
            {designIds().map((id) => (
              <option key={id} value={id}>
                {findDesign(id)?.name ?? id}
              </option>
            ))}
          </select>
          {canvas !== undefined ? (
            <p className={styles.hint}>
              {canvas.width} × {canvas.height} px
            </p>
          ) : null}
        </div>

        <label htmlFor="setup-provider">Datenquelle</label>
        <select
          id="setup-provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        >
          {providers.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

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

const stationHint = ({ station, isLoading, error }: StationLookup) => {
  if (isLoading) return 'Suche …';
  // The provider's own message is technical and English; here it only matters that the
  // number could not be checked — the link still works if the number is right.
  if (error !== null)
    return 'Bahnhof konnte nicht geprüft werden, die Datenquelle antwortet nicht.';
  if (station === null) return 'Unter dieser Nummer ist kein Bahnhof bekannt.';
  if (station !== undefined) return station.name;
  return '';
};

/** Numbers by value, a lettered platform right after its number: 1, 1a, 2, …, 10. */
const byPlatformLabel = (a: string, b: string): number =>
  a.localeCompare(b, 'de', { numeric: true });

/** The display lives next to this page: same path, minus the trailing `setup`. */
const displayUrl = (search: string): string => {
  const path = window.location.pathname.replace(/setup\/?$/, '');
  return `${window.location.origin}${path}?${search}`;
};
