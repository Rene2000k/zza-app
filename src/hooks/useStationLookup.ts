import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createProvider } from '@/providers/registry';
import type { StationDetails } from '@/domain/station';

const EVA_NUMBER = /^\d{7,8}$/;

export interface StationLookup {
  /** The station under this EVA number; null once the source has said it knows none. */
  readonly station: StationDetails | null | undefined;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

/**
 * Looks up one station by EVA number, for the setup page: its name confirms that the
 * number is the intended one, and its platform list offers the platforms to choose from.
 *
 * Nothing is asked before the input has the shape of an EVA number, so typing does not
 * send a request per keystroke. A station's details do not change while someone is
 * filling in a form, so an answer is kept for the session.
 */
export const useStationLookup = (providerId: string, evaNumber: string): StationLookup => {
  const provider = useMemo(() => createProvider(providerId), [providerId]);

  const query = useQuery({
    queryKey: ['station', providerId, evaNumber],
    queryFn: async ({ signal }) => {
      const candidates = await provider.resolveStation(evaNumber, signal);
      // A source may answer a query with near matches; only the exact number counts here.
      return candidates.find((candidate) => candidate.evaNumber === evaNumber) ?? null;
    },
    enabled: EVA_NUMBER.test(evaNumber),
    staleTime: Infinity,
    retry: 1,
  });

  return { station: query.data, isLoading: query.isLoading, error: query.error };
};
