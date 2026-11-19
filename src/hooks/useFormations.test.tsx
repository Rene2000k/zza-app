import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFormations } from './useFormations';
import { createFormationProvider } from '@/providers/formationRegistry';
import { mockEntries } from '@/providers/mock/fixtures';
import type { ReactNode } from 'react';
import type { StationBoard } from '@/domain/board';
import type { TrainFormation } from '@/domain/formation';
import type { FormationProvider, FormationRequest } from '@/providers/types';

const reference = new Date('2026-09-09T08:00:00+02:00');

const board: StationBoard = {
  station: { evaNumber: '8000105', name: 'Frankfurt(Main)Hbf' },
  entries: mockEntries(reference),
  fetchedAt: reference,
};

const ice571: TrainFormation = {
  coaches: [
    { number: '1', travelClass: 'first', features: [] },
    { number: '2', travelClass: 'second', features: ['bicycles'] },
  ],
  sections: ['C', 'D'],
  accuracy: 'actual',
};

const isIce571 = (request: FormationRequest) =>
  request.train.category === 'ICE' && request.train.number === '571';

/** A provider that knows ICE 571 only, answering whenever `answer` lets it. */
const fakeProvider = (answer: Promise<void> = Promise.resolve()) => {
  const getFormation = vi.fn(async (request: FormationRequest) => {
    await answer;
    return isIce571(request) ? ice571 : null;
  });
  const provider: FormationProvider = { id: 'fake', name: 'Fake', getFormation };
  return { provider, getFormation };
};

const renderFormations = (
  provider: FormationProvider,
  { input = board, refreshSeconds = 30 }: { input?: StationBoard; refreshSeconds?: number } = {},
) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFormations(provider, input, refreshSeconds), { wrapper });
};

const formationOf = (result: StationBoard | undefined, id: string) =>
  result?.entries.find((entry) => entry.id === id)?.formation;

describe('useFormations', () => {
  it('gives each departure the Wagenreihung its provider knows', async () => {
    const { provider } = fakeProvider();
    const { result } = renderFormations(provider);

    await waitFor(() => expect(formationOf(result.current, 'mock-ice-571')).toEqual(ice571));
    expect(formationOf(result.current, 'mock-re-4168')).toBeUndefined();
  });

  it('asks with the train, its planned departure, the station, origin and remaining route', async () => {
    const { provider, getFormation } = fakeProvider();
    renderFormations(provider);

    await waitFor(() =>
      expect(getFormation).toHaveBeenCalledWith(
        {
          train: { category: 'ICE', number: '571' },
          plannedDeparture: new Date('2026-09-09T06:04:00Z'),
          station: 'Frankfurt(Main)Hbf',
          origin: 'Hamburg-Altona',
          route: ['Frankfurt(M) Flughafen Fernbf', 'Mannheim Hbf', 'Stuttgart Hbf'],
        },
        expect.anything(),
      ),
    );
  });

  it('does not ask about trains that end here, which do not depart', async () => {
    const { provider, getFormation } = fakeProvider();
    renderFormations(provider);

    const departures = board.entries.filter((entry) => entry.kind === 'departure');
    expect(departures.length).toBeLessThan(board.entries.length);
    await waitFor(() => expect(getFormation).toHaveBeenCalledTimes(departures.length));
  });

  it('hands the board on at once, before the provider has answered', () => {
    const { provider } = fakeProvider(new Promise<void>(() => {}));
    const { result } = renderFormations(provider);

    expect(result.current?.entries).toHaveLength(board.entries.length);
    expect(result.current?.entries.every((entry) => entry.formation === undefined)).toBe(true);
  });

  it('picks up a Wagenreihung that becomes known while the train is on the board', async () => {
    let known = false;
    const getFormation = vi.fn((request: FormationRequest) =>
      Promise.resolve(known && isIce571(request) ? ice571 : null),
    );
    const provider: FormationProvider = { id: 'daily', name: 'Daily', getFormation };
    const { result } = renderFormations(provider, { refreshSeconds: 0.05 });

    await waitFor(() => expect(getFormation).toHaveBeenCalled());
    expect(formationOf(result.current, 'mock-ice-571')).toBeUndefined();

    known = true;
    await waitFor(() => expect(formationOf(result.current, 'mock-ice-571')).toEqual(ice571));
  });

  it('leaves the entries without a Wagenreihung when the provider fails', async () => {
    const getFormation = vi.fn(() => Promise.reject(new Error('provider down')));
    const provider: FormationProvider = { id: 'failing', name: 'Failing', getFormation };
    const { result } = renderFormations(provider);

    await waitFor(() => expect(getFormation).toHaveBeenCalled());
    expect(result.current?.entries.every((entry) => entry.formation === undefined)).toBe(true);
  });

  it('changes nothing with the "none" provider', async () => {
    const { result } = renderFormations(createFormationProvider('none'));

    await waitFor(() => expect(result.current?.entries).toEqual(board.entries));
  });

  it('has no board to fill while none has arrived', () => {
    const { provider } = fakeProvider();
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useFormations(provider, undefined, 30), { wrapper });
    expect(result.current).toBeUndefined();
  });
});
