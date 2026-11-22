import { parseDirectory } from './directory';
import type { DirectoryEntry } from './directory';
import type { FormationProvider, FormationRequest } from '@/providers/types';

/**
 * Where the dev server finds the saved directory page: a folder at the project root that git
 * ignores, so fernbahn.de's collection is never committed. The dev server serves it unchanged
 * (see vite.config.ts); a production build does not include it.
 */
const DIRECTORY_URL = `${import.meta.env.BASE_URL}local-data/fernbahn-reihungsverzeichnis.html`;

/**
 * Planmäßige Wagenreihungen from a locally saved copy of the fernbahn.de Reihungsverzeichnis
 * (ADR-0015). A proof of concept that runs on the localhost machine only: the page is a
 * private collection, not open data, and must not be published with this repository.
 *
 * The file is read once and kept for the session — it changes per timetable year, not per poll.
 * Missing or unreadable, it counts as an empty directory: every request answers none.
 *
 * The coaches come in directory order, coach 1 first, without Bahnsteigabschnitte.
 */
export const createLocalFernbahnProvider = (): FormationProvider => {
  let directory: Promise<DirectoryEntry[]> | undefined;
  const load = () => {
    directory ??= readDirectory(DIRECTORY_URL);
    return directory;
  };

  return {
    id: 'fernbahn-local',
    name: 'fernbahn.de (lokale Kopie)',
    getFormation: async (request) => {
      const entry = variantFor(request, await load());
      return entry === undefined ? null : { coaches: entry.coaches, accuracy: 'scheduled' };
    },
  };
};

/**
 * The one variant that fits the departure, or none. A train number commonly has several, by
 * validity period, operating days and starting station; no Wagenreihung is better than a wrong
 * one, so whatever cannot be decided gives none:
 *
 * 1. category and number match;
 * 2. the departure's date, in Germany, lies within the validity period;
 * 3. the train runs on the departure's weekday;
 * 4. of several still left, the one whose origin and destination are the departure's.
 */
const variantFor = (
  { train, plannedDeparture, origin, route }: FormationRequest,
  directory: readonly DirectoryEntry[],
): DirectoryEntry | undefined => {
  const date = berlinDate(plannedDeparture);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const validThatDay = directory.filter(
    (entry) =>
      entry.category === train.category &&
      entry.number === train.number &&
      entry.validity.from <= date &&
      date <= entry.validity.to &&
      entry.validity.weekdays.has(weekday),
  );
  const destination = route.at(-1);
  const candidates =
    validThatDay.length <= 1 || origin === undefined || destination === undefined
      ? validThatDay
      : validThatDay.filter(
          (entry) =>
            sameStation(entry.origin, origin) && sameStation(entry.destination, destination),
        );
  return candidates.length === 1 ? candidates[0] : undefined;
};

/**
 * Station names as the departure source and the directory spell them alike: "Frankfurt(Main)Hbf"
 * and "Frankfurt (Main) Hbf". Case, whitespace, brackets and hyphens are ignored; nothing else is.
 */
const sameStation = (a: string, b: string): boolean => normalized(a) === normalized(b);

const normalized = (station: string): string => station.toLowerCase().replace(/[\s()[\]-]/g, '');

/** `YYYY-MM-DD` — the calendar day in Germany, which the directory's dates refer to. */
const berlinDate = (instant: Date): string => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const readDirectory = async (url: string): Promise<DirectoryEntry[]> => {
  try {
    // Not tied to any one request's signal: the file is shared by all of them.
    const response = await fetch(url);
    return response.ok ? parseDirectory(await response.text()) : [];
  } catch {
    return [];
  }
};
