import { useQueries } from '@tanstack/react-query';
import { jitteredIntervalMs, seededUnit } from './useBoard';
import type { StationBoard } from '@/domain/board';
import type { BoardEntry, DepartureEntry } from '@/domain/boardEntry';
import type { FormationProvider, FormationRequest } from '@/providers/types';

const requestFor = (entry: DepartureEntry, station: string): FormationRequest => ({
  train: { category: entry.train.category, number: entry.train.number },
  plannedDeparture: entry.time.planned,
  station,
  ...(entry.origin === undefined ? {} : { origin: entry.origin.name }),
  route: [...entry.via, entry.destination].map((stop) => stop.name),
});

/**
 * Joins Wagenreihungen from their own provider onto a polled board (ADR-0015).
 *
 * Every departure is looked up as a query of its own, so the board never waits for them: it is
 * handed on at once, and an entry gains its Wagenreihung once the provider has answered. Until
 * then, and whenever the provider has none or fails, the entry stays without one — the normal
 * case, which the Wagenstandsanzeiger shows as its idle state.
 *
 * Each Wagenreihung is asked again as often as the board is polled, because a tagesaktuelle
 * Wagenreihung can change while the train is on the board. How long an answer holds is the
 * provider's to know: one that only has planmäßige Wagenreihungen caches them itself.
 */
export const useFormations = (
  provider: FormationProvider,
  board: StationBoard | undefined,
  refreshSeconds: number,
): StationBoard | undefined => {
  const station = board?.station.name;
  const departures =
    board?.entries.filter((entry): entry is DepartureEntry => entry.kind === 'departure') ?? [];

  const answers = useQueries({
    queries: departures.map((entry) => {
      const request = requestFor(entry, station ?? '');
      return {
        queryKey: ['formation', provider.id, request],
        queryFn: ({ signal }: { signal: AbortSignal }) => provider.getFormation(request, signal),
        // Jittered and seeded like the board's poll (see useBoard), so displays do not ask in
        // lockstep and the timer is not restarted on every render.
        refetchInterval: (query: { state: { dataUpdatedAt: number; errorUpdatedAt: number } }) =>
          jitteredIntervalMs(refreshSeconds, () =>
            seededUnit(query.state.dataUpdatedAt + query.state.errorUpdatedAt),
          ),
        refetchIntervalInBackground: true,
        // A missing Wagenreihung is the normal case, not worth three more requests per entry;
        // the next poll asks again anyway.
        retry: false,
      };
    }),
  });

  if (board === undefined) return undefined;

  const formationById = new Map(
    departures.flatMap((entry, index) => {
      const formation = answers[index]?.data;
      return formation == null ? [] : [[entry.id, formation] as const];
    }),
  );
  if (formationById.size === 0) return board;

  return {
    ...board,
    entries: board.entries.map((entry): BoardEntry => {
      const formation = formationById.get(entry.id);
      return formation === undefined ? entry : { ...entry, formation };
    }),
  };
};
