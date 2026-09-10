import { z } from 'zod';

/**
 * One display instance, described completely.
 *
 * Read from the URL query so a configured display is a shareable link — the form a
 * kiosk needs. Unknown or malformed values are reported rather than silently defaulted,
 * because a display showing the wrong station is worse than one showing an error.
 */
export const displayConfigSchema = z.object({
  /** EVA number of the station. */
  station: z.string().regex(/^\d{7,8}$/, 'station must be an EVA number, e.g. 8000105'),
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

/** Parse a URL query string into a configuration, collecting all problems. */
export const parseConfig = (search: string): ConfigResult => {
  const params = new URLSearchParams(search);
  const raw = Object.fromEntries(params.entries());
  const parsed = displayConfigSchema.safeParse(raw);

  if (parsed.success) {
    return { ok: true, config: parsed.data };
  }
  return {
    ok: false,
    problems: parsed.error.issues.map((issue) =>
      issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    ),
  };
};

/** Render a configuration back into a query string, for share links. */
export const toSearch = (config: DisplayConfig): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
};
