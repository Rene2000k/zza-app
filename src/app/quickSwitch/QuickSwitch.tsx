import { useEffect, useState } from 'react';
import { parseConfig, toSearch } from '../config';
import { setupHref } from '../links';
import { ConfigFields } from '../setup/ConfigFields';
import { fieldParams } from '../setup/configFieldValues';
import styles from './QuickSwitch.module.css';
import type { DisplayConfig } from '../config';
import type { ConfigFieldValues } from '../setup/configFieldValues';

export interface QuickSwitchProps {
  readonly config: DisplayConfig;
  /** Replaced in tests; loads the display under the new query otherwise. */
  readonly navigate?: (search: string) => void;
}

const PANEL_ID = 'quick-switch-panel';

/**
 * Switch station, platform, source or design from the display itself, behind a menu
 * button at the edge.
 *
 * Switching loads the display under the new link, the same as opening it: the query stays
 * the one place the configuration lives, so the address bar — and a kiosk's start URL
 * copied from it — always shows what is on screen. Everything else in the link (poll
 * interval, horizon, a simulated clock) is carried over unchanged.
 *
 * The button fades out with the cursor, so a display nobody touches shows no control.
 */
export const QuickSwitch = ({ config, navigate = loadDisplay }: QuickSwitchProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-label="Schnellwechsel"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((current) => !current)}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <span />
        <span />
        <span />
      </button>
      {open ? (
        <QuickSwitchPanel config={config} navigate={navigate} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
};

/** Mounted only while open, so every opening starts from the configuration on screen. */
const QuickSwitchPanel = ({
  config,
  navigate,
  onClose,
}: Required<QuickSwitchProps> & { readonly onClose: () => void }) => {
  const [fields, setFields] = useState<ConfigFieldValues>({
    station: config.station,
    platform: config.platform ?? '',
    design: config.design,
    provider: config.provider,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const params = new URLSearchParams(toSearch(config));
  for (const key of ['station', 'platform', 'design', 'provider']) params.delete(key);
  for (const [key, value] of Object.entries(fieldParams(fields))) params.set(key, value);
  const result = parseConfig(params.toString());
  const next = result.ok ? toSearch(result.config) : undefined;
  const changed = next !== undefined && next !== toSearch(config);

  return (
    <aside
      id={PANEL_ID}
      className={styles.panel}
      aria-label="Schnellwechsel"
      // A double-click in a field selects text; it must not reach the frame and toggle fullscreen.
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <h2>Schnellwechsel</h2>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) navigate(next);
        }}
      >
        <ConfigFields idPrefix="switch" values={fields} onChange={setFields} autoFocus />
        <div className={styles.actions}>
          <button type="submit" disabled={!changed}>
            Wechseln
          </button>
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </form>

      {result.ok ? null : (
        <ul className={styles.problems}>
          {result.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <p className={styles.more}>
        <a href={setupHref()}>Weitere Einstellungen</a>
      </p>
    </aside>
  );
};

const loadDisplay = (search: string) => {
  window.location.assign(`${window.location.pathname}?${search}`);
};
