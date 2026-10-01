import { z } from 'zod';
import { designIds, findDesign } from '@/designs/registry';
import { providerIds } from '@/providers/registry';

/**
 * One display instance, described completely.
 *
 * Read from the URL query so a configured display is a shareable link — the form a
 * kiosk needs. Unknown or malformed values are reported rather than silently defaulted,
 * because a display showing the wrong station is worse than one showing an error.
 */
export const displayConfigSchema = z.object({
  /** EVA number of the station. */
  station: z.string().regex(/^\d{7,8}$/),
  /** Platform label; omitted means the whole station. */
  platform: z.string().min(1).optional(),
  /** Design id from the design registry. */
  design: z.string().min(1).default('debug'),
  /** Provider id from the provider registry. */
  provider: z.string().min(1).default('mock'),
  /** Poll interval in seconds. Lower bound keeps the source treated politely. */
  refreshSeconds: z.coerce.number().int().min(10).max(600).default(30),
  /** How far ahead the board looks, in minutes. */
  horizonMinutes: z.coerce.number().int().min(5).max(360).default(120),
  /**
   * Freeze the clock at this instant (ISO 8601) — the demo mode of ADR-0004.
   * Only meaningful together with a fixture provider.
   */
  simulatedTime: z.string().datetime({ offset: true }).optional(),
  /** Run the clock faster than real time; 60 turns a minute into a second. */
  timeFactor: z.coerce.number().positive().max(3600).optional(),
});

export type DisplayConfig = z.infer<typeof displayConfigSchema>;

export type ConfigResult =
  | { readonly ok: true; readonly config: DisplayConfig }
  | { readonly ok: false; readonly problems: readonly string[] };

type ConfigKey = keyof DisplayConfig;

/**
 * What each parameter must look like, in the language of the display and its setup page.
 *
 * One sentence per parameter instead of zod's per-check messages: those are English and
 * name the failed check ("Too small: expected number to be >=10"), where the reader needs
 * to know what a valid value is. The query key stays in the label, because on the display's
 * error page it is the name to look for in the link.
 */
const problemByKey: Record<ConfigKey, string> = {
  station: 'Bahnhof (station): muss eine EVA-Nummer mit 7 oder 8 Ziffern sein, z. B. 8000105',
  platform: 'Gleis (platform): darf nicht leer sein — für alle Gleise den Parameter weglassen',
  design: 'Design (design): fehlt',
  provider: 'Datenquelle (provider): fehlt',
  refreshSeconds: 'Abrufintervall (refreshSeconds): ganze Zahl von 10 bis 600 Sekunden',
  horizonMinutes: 'Vorschau (horizonMinutes): ganze Zahl von 5 bis 360 Minuten',
  simulatedTime:
    'Simulierte Zeit (simulatedTime): Zeitpunkt nach ISO 8601 mit Zeitzone, z. B. 2026-09-09T08:00:00+02:00',
  timeFactor: 'Zeitfaktor (timeFactor): positive Zahl bis 3600',
};

const isConfigKey = (key: PropertyKey | undefined): key is ConfigKey =>
  typeof key === 'string' && key in problemByKey;

/** Parse a URL query string into a configuration, collecting all problems. */
export const parseConfig = (search: string): ConfigResult => {
  const params = new URLSearchParams(search);
  const raw = Object.fromEntries(params.entries());
  const parsed = displayConfigSchema.safeParse(raw);

  if (!parsed.success) {
    // A value can fail several checks at once (not an integer *and* too small); the
    // reader needs to hear about the parameter once.
    const keys = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    return {
      ok: false,
      problems: [...keys].map((key) =>
        isConfigKey(key) ? problemByKey[key] : `Ungültiger Parameter ${String(key)}`,
      ),
    };
  }

  // Checked here rather than in the schema: which designs and sources exist is a fact about
  // the registries, and naming the available ones turns a typo into a usable message.
  const problems: string[] = [];
  if (findDesign(parsed.data.design) === undefined) {
    problems.push(
      `Design (design): „${parsed.data.design}“ gibt es nicht, verfügbar: ${designIds().join(', ')}`,
    );
  }
  if (!providerIds().includes(parsed.data.provider)) {
    problems.push(
      `Datenquelle (provider): „${parsed.data.provider}“ gibt es nicht, verfügbar: ${providerIds().join(', ')}`,
    );
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, config: parsed.data };
};

/** Render a configuration back into a query string, for share links. */
export const toSearch = (config: DisplayConfig): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
};
