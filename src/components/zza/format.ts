/**
 * The facts a display field can print — never the choice of which one to print.
 *
 * Generations differ in what they state from the same data: one prints the deviation from
 * the timetable, "+7", where another prints the actual departure time, "10:57", in the same
 * field. That choice belongs to the design; these functions make either one cheap and keep
 * the rules behind them in one place (ADR-0009).
 */

/**
 * A display prints the local time of its station, and every station this project serves is
 * in Germany, so the zone is fixed rather than configured.
 */
const clockTimeFormat = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
});

/** "10:52" — hours and minutes, for a timetabled or an expected instant alike. */
export const formatClockTime = (instant: Date): string => clockTimeFormat.format(instant);

/**
 * "+7" for whole minutes late, or undefined for a train on time or early. It takes minutes,
 * not times, so a design decides which delay it states — `delayMinutes` of the times, or
 * `announcedDelayMinutes`, which a cancelled train sets to none.
 *
 * Undefined rather than an empty string: a field with nothing to say stays empty, and a
 * design can tell that apart from a text it has to draw.
 */
export const formatDelay = (minutes: number): string | undefined =>
  minutes > 0 ? `+${minutes}` : undefined;
