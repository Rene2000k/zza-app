/**
 * IRIS timestamps and URL date parameters are Europe/Berlin wall-clock values with no
 * offset attached (ADR-0002's `pt`/`ct`, ten digits `YYMMDDHHmm`; the `plan` endpoint's
 * `{yymmdd}/{hh}` path segments). Converting between those and an absolute instant has
 * to go through the real Berlin offset for that instant — a fixed +1 or +2 is wrong
 * across the DST boundary (ADR-0004: all time handling in this project is DST-safe).
 *
 * There is no timezone library in this project (see the dependency-avoidance reasoning
 * in ADR-0007): `Intl.DateTimeFormat` already knows the IANA rules, so it is used to
 * read the offset instead.
 */

const berlinParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const partsOf = (instant: Date): Record<string, string> =>
  Object.fromEntries(berlinParts.formatToParts(instant).map((part) => [part.type, part.value]));

/** This instant's wall-clock date and hour in Europe/Berlin, for the `plan` endpoint's path. */
export interface BerlinDateHour {
  /** `yymmdd`, as the endpoint's URL expects it. */
  readonly yymmdd: string;
  /** `hh`, zero-padded. */
  readonly hh: string;
}

export const berlinDateHour = (instant: Date): BerlinDateHour => {
  const parts = partsOf(instant);
  const yy = parts.year?.slice(-2);
  const mm = parts.month;
  const dd = parts.day;
  const hh = parts.hour;
  if (yy === undefined || mm === undefined || dd === undefined || hh === undefined) {
    throw new Error('berlinDateHour: Intl.DateTimeFormat did not report the expected parts');
  }
  return { yymmdd: `${yy}${mm}${dd}`, hh };
};

/**
 * The distinct `plan` hour buckets that cover `[start, start + spanMinutes]`, in order.
 *
 * A board's window commonly spans more than one hour, and `plan` is served one wall-clock
 * Europe/Berlin hour at a time — the caller fetches one request per returned bucket and
 * merges the results.
 */
export const berlinHoursCovering = (start: Date, spanMinutes: number): BerlinDateHour[] => {
  const end = start.getTime() + spanMinutes * 60_000;
  const seen = new Set<string>();
  const hours: BerlinDateHour[] = [];
  for (let cursor = start.getTime(); cursor <= end; cursor += 3_600_000) {
    const bucket = berlinDateHour(new Date(cursor));
    const key = `${bucket.yymmdd}${bucket.hh}`;
    if (!seen.has(key)) {
      seen.add(key);
      hours.push(bucket);
    }
  }
  // The loop steps in fixed 1h increments from `start`; if that overshoots the bucket
  // containing `end` it is still added explicitly, so a horizon just past an hour
  // boundary always gets its last partial hour.
  const endBucket = berlinDateHour(new Date(end));
  const endKey = `${endBucket.yymmdd}${endBucket.hh}`;
  if (!seen.has(endKey)) {
    hours.push(endBucket);
  }
  return hours;
};

/**
 * The Europe/Berlin UTC offset, in minutes, for the moment `instant` names.
 *
 * Used to correct a naive "read the wall-clock digits as if they were UTC" guess back
 * to the real instant (see `parseIrisTimestamp`).
 */
const berlinOffsetMinutes = (instant: Date): number => {
  const parts = partsOf(instant);
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asIfUtc - instant.getTime()) / 60_000;
};

/**
 * Parses an IRIS timestamp (`YYMMDDHHmm`, Europe/Berlin wall-clock, e.g. `2609101651`
 * for 2026-09-10 16:51) into the instant it names.
 *
 * Ambiguous or non-existent wall-clock times at the DST transition itself are an
 * inherent limitation of a bare wall-clock string with no offset attached — not
 * something this project's data can resolve, IRIS included.
 */
export const parseIrisTimestamp = (raw: string): Date => {
  if (!/^\d{10}$/.test(raw)) {
    throw new Error(`parseIrisTimestamp: expected YYMMDDHHmm, got "${raw}"`);
  }
  const year = 2000 + Number(raw.slice(0, 2));
  const month = Number(raw.slice(2, 4));
  const day = Number(raw.slice(4, 6));
  const hour = Number(raw.slice(6, 8));
  const minute = Number(raw.slice(8, 10));

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset = berlinOffsetMinutes(new Date(naiveUtc, ));
  return new Date(naiveUtc - offset * 60_000);
};
