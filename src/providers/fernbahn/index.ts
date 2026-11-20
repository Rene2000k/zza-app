import { parseDirectory } from './directory';
import type { DirectoryEntry } from './directory';
import type { FormationProvider } from '@/providers/types';

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
 * Matching is minimal for now: the category and number must match, and exactly one entry must
 * remain. A train with several variants has none, since no Wagenreihung is better than a wrong
 * one. The coaches come in directory order, coach 1 first, without Bahnsteigabschnitte.
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
    getFormation: async ({ train }) => {
      const matches = (await load()).filter(
        (entry) => entry.category === train.category && entry.number === train.number,
      );
      const [entry] = matches;
      if (matches.length !== 1 || entry === undefined) return null;
      return { coaches: entry.coaches, accuracy: 'scheduled' };
    },
  };
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
