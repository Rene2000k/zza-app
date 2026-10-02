import { designIds, findDesign } from '@/designs/registry';
import { useStationLookup } from '@/hooks/useStationLookup';
import { createProvider, providerIds } from '@/providers/registry';
import styles from './ConfigFields.module.css';
import type { ConfigFieldValues } from './configFieldValues';
import type { StationLookup } from '@/hooks/useStationLookup';

export interface ConfigFieldsProps {
  /** Prefix for element ids, so two forms on one page cannot collide. */
  readonly idPrefix: string;
  readonly values: ConfigFieldValues;
  readonly onChange: (next: ConfigFieldValues) => void;
  /** Puts the cursor into the station field when the fields appear. */
  readonly autoFocus?: boolean;
}

const providers = providerIds().map((id) => ({ id, name: createProvider(id).name }));

/**
 * Station, platform, design and source, shared by the setup page and the display's quick
 * switch. Renders label/field pairs without a wrapper, so the caller's grid lays them out.
 *
 * The EVA number is confirmed by the station's name as the selected source knows it, and
 * that station's platforms are offered for the platform field.
 */
export const ConfigFields = ({
  idPrefix,
  values,
  onChange,
  autoFocus = false,
}: ConfigFieldsProps) => {
  const lookup = useStationLookup(values.provider, values.station.trim());
  const canvas = findDesign(values.design)?.canvas;
  const set = (key: keyof ConfigFieldValues) => (value: string) =>
    onChange({ ...values, [key]: value });

  return (
    <>
      <label htmlFor={`${idPrefix}-station`}>Bahnhof (EVA-Nummer)</label>
      <div>
        <input
          id={`${idPrefix}-station`}
          inputMode="numeric"
          placeholder="z. B. 8000105"
          // The quick switch opens on demand; landing in its first field is what was asked for.
          autoFocus={autoFocus}
          value={values.station}
          onChange={(event) => set('station')(event.target.value)}
        />
        <p className={styles.hint} aria-live="polite">
          {stationHint(lookup)}
        </p>
      </div>

      <label htmlFor={`${idPrefix}-platform`}>Gleis</label>
      <div>
        <input
          id={`${idPrefix}-platform`}
          list={`${idPrefix}-platforms`}
          placeholder="leer = alle Gleise"
          value={values.platform}
          onChange={(event) => set('platform')(event.target.value)}
        />
        <datalist id={`${idPrefix}-platforms`}>
          {/* IRIS reports platforms in no useful order ("22|23|24|1a|10|…"); a form sorts them. */}
          {lookup.station?.platforms.toSorted(byPlatformLabel).map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      </div>

      <label htmlFor={`${idPrefix}-design`}>Design</label>
      <div>
        <select
          id={`${idPrefix}-design`}
          value={values.design}
          onChange={(event) => set('design')(event.target.value)}
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

      <label htmlFor={`${idPrefix}-provider`}>Datenquelle</label>
      <select
        id={`${idPrefix}-provider`}
        value={values.provider}
        onChange={(event) => set('provider')(event.target.value)}
      >
        {providers.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </>
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
