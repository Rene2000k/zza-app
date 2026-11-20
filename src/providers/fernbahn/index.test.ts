import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalFernbahnProvider } from './index';
import type { FormationRequest } from '@/providers/types';

/**
 * Through the provider's public interface: a directory page in, a Wagenreihung or none out. The
 * page is a hand-written imitation with invented trains (see the fixture's own note).
 */
const directory = readFileSync(
  join(process.cwd(), 'src/providers/fernbahn/__fixtures__/reihungsverzeichnis.html'),
  'utf-8',
);

const serving = (response: () => Promise<Response>) => {
  const fetchMock = vi.fn(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const servingDirectory = () =>
  serving(() => Promise.resolve(new Response(directory, { status: 200 })));

const request = (category: string, number: string): FormationRequest => ({
  train: { category, number },
  plannedDeparture: new Date('2026-03-10T08:00:00+01:00'),
  station: 'Musterstadt Hbf',
  route: ['Beispielburg'],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createLocalFernbahnProvider', () => {
  it('gives the planmäßige Wagenreihung of the one entry with that train', async () => {
    servingDirectory();
    const formation = await createLocalFernbahnProvider().getFormation(request('ICE', '1234'));

    expect(formation?.accuracy).toBe('scheduled');
    expect(formation?.coaches.map(({ number, travelClass }) => ({ number, travelClass }))).toEqual([
      { number: '1', travelClass: 'second' },
      { number: '2', travelClass: 'second' },
      { number: '3', travelClass: 'none' },
      { number: '4', travelClass: 'mixed' },
      { number: '5', travelClass: 'first' },
    ]);
  });

  it('gives the coaches the average coach length of their train type', async () => {
    servingDirectory();
    const formation = await createLocalFernbahnProvider().getFormation(request('ICE', '1234'));

    // An ICE 4 with 12 coaches is 345.72 m long.
    for (const coach of formation?.coaches ?? []) {
      expect(coach.lengthMetres).toBeCloseTo(28.81, 2);
    }
  });

  it('takes the standard UIC coach length for a train type it does not know', async () => {
    servingDirectory();
    const formation = await createLocalFernbahnProvider().getFormation(request('IC', '1234'));

    expect(formation?.coaches.map((coach) => coach.lengthMetres)).toEqual([26.4, 26.4]);
  });

  it('gives no Bahnsteigabschnitte — placing the train is not its job', async () => {
    servingDirectory();
    const formation = await createLocalFernbahnProvider().getFormation(request('ICE', '1234'));

    expect(formation?.coaches.every((coach) => coach.section === undefined)).toBe(true);
  });

  // A control car is told by the "f" in its UIC type code (Bpmdzf, Apmzf), the cab.
  it('carries the coach features the directory lists', async () => {
    servingDirectory();
    const ice = await createLocalFernbahnProvider().getFormation(request('ICE', '1234'));
    const ic = await createLocalFernbahnProvider().getFormation(request('IC', '1234'));

    expect(ice?.coaches.map((coach) => coach.features)).toEqual([
      ['controlCar', 'bicycles'],
      ['familyZone', 'wheelchair'],
      ['dining'],
      [],
      ['controlCar'],
    ]);
    expect(ic?.coaches).toMatchObject([
      { travelClass: 'none', features: ['locomotive'] },
      { number: '21', travelClass: 'second', features: ['dining'] },
    ]);
    expect(ic?.coaches[0]?.number).toBeUndefined();
  });

  it('reads the category of a train the directory shows with a logo', async () => {
    servingDirectory();
    const formation = await createLocalFernbahnProvider().getFormation(request('EC', '4321'));

    expect(formation?.coaches.map((coach) => coach.number)).toEqual(['250']);
  });

  // The directory titles both "Lok/Triebkopf"; only the type code tells them apart.
  it('tells a power car from a locomotive', async () => {
    servingDirectory();
    const formation = await createLocalFernbahnProvider().getFormation(request('ICE', '4711'));

    expect(formation?.coaches).toMatchObject([
      { travelClass: 'none', features: ['powerCar'] },
      { number: '41', features: [] },
      { travelClass: 'none', features: ['powerCar'] },
    ]);
    expect(formation?.coaches[0]?.number).toBeUndefined();
  });

  it('has none for a train the directory does not list', async () => {
    servingDirectory();
    const provider = createLocalFernbahnProvider();

    expect(await provider.getFormation(request('ICE', '9999'))).toBeNull();
    expect(await provider.getFormation(request('EC', '1234'))).toBeNull();
  });

  it('has none while several entries fit, rather than guess', async () => {
    servingDirectory();
    expect(await createLocalFernbahnProvider().getFormation(request('ICE', '5550'))).toBeNull();
  });

  it('has none, without an error, when the file is missing', async () => {
    serving(() => Promise.resolve(new Response('Not Found', { status: 404 })));
    expect(await createLocalFernbahnProvider().getFormation(request('ICE', '1234'))).toBeNull();
  });

  it('has none, without an error, when the file cannot be read', async () => {
    serving(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await createLocalFernbahnProvider().getFormation(request('ICE', '1234'))).toBeNull();
  });

  it('has none, without an error, when the file is not a directory page', async () => {
    serving(() => Promise.resolve(new Response('<html><body>Something else', { status: 200 })));
    expect(await createLocalFernbahnProvider().getFormation(request('ICE', '1234'))).toBeNull();
  });

  it('reads the file once for the whole session', async () => {
    const fetchMock = servingDirectory();
    const provider = createLocalFernbahnProvider();

    await provider.getFormation(request('ICE', '1234'));
    await provider.getFormation(request('IC', '1234'));
    await provider.getFormation(request('ICE', '9999'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
