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

/**
 * Picking among the variants of one train number. Each page is built from invented entries in
 * the directory's markup; a variant is told by the number of its single coach.
 */
describe('createLocalFernbahnProvider — picking the variant', () => {
  const page = (...entries: readonly string[]) => `<!doctype html>
    <html lang="de"><body>
      <form><select name="fahrplan_jahr" size="1">
        <option value="2027">2027</option>
        <option selected value="2026">2026</option>
        <option value="2025">2025</option>
      </select></form>
      <section id="reihungsverzeichnis-liste">${entries.join('\n')}</section>
    </body></html>`;

  const time = (iso: string) => {
    const [year, month, day] = iso.split('-');
    return `<time datetime="${iso}">${day}.${month}.${year}</time>`;
  };

  /** "Reihung gültig tgl 01.03.2026 bis 31.03.2026" and its kin. */
  const validity = ({
    days = '<abbr title="täglich">tgl</abbr>',
    from,
    to,
  }: {
    days?: string;
    from?: string;
    to?: string;
  }) => {
    const period =
      from !== undefined && to !== undefined
        ? `${time(from)} bis ${time(to)}`
        : from !== undefined
          ? `ab ${time(from)}`
          : to !== undefined
            ? `bis ${time(to)}`
            : '';
    return `Reihung gültig ${days} ${period}`;
  };

  const variant = ({
    coach,
    number = '700',
    origin = 'Musterstadt Hbf',
    destination = 'Beispielburg',
    valid = '',
  }: {
    coach: string;
    number?: string;
    origin?: string;
    destination?: string;
    valid?: string;
  }) => `
    <div class="reihungsverzeichnis-eintrag gattung_ice">
      <div class="zugnr"><span><abbr title="InterCityExpress"><strong>ICE</strong></abbr> ${number}</span></div>
      <div class="vonbis">${origin} &mdash; ${destination}</div>
      <div class="tfz">ICE 3</div>
      <div class="wagenreihung">
        <div class="wagen">
          <span class="wagen-nummer">${coach}</span>
          <a class="wagen-design wagen-innen" title="2. Klasse">&nbsp;</a>
          <span class="wagen-gattung">Bpmz</span>
        </div>
      </div>
      <div class="zugname">${valid}
        <span class="reihungsverzeichnis-eintrag-zug-link"><a href="?zug_id=1">ansehen</a></span>
      </div>
    </div>`;

  const serve = (...entries: readonly string[]) =>
    serving(() => Promise.resolve(new Response(page(...entries), { status: 200 })));

  const departing = (
    plannedDeparture: string,
    { origin = 'Musterstadt Hbf', destination = 'Beispielburg' } = {},
  ): FormationRequest => ({
    train: { category: 'ICE', number: '700' },
    plannedDeparture: new Date(plannedDeparture),
    station: 'Mittelstadt',
    origin,
    route: ['Zwischenhalt', destination],
  });

  /** The number of the chosen variant's coach, or null for none. */
  const chosen = async (departure: FormationRequest) => {
    const formation = await createLocalFernbahnProvider().getFormation(departure);
    return formation === null ? null : (formation.coaches[0]?.number ?? '');
  };

  it('picks the variant valid on the departure date', async () => {
    serve(
      variant({ coach: '1', valid: validity({ from: '2026-03-01', to: '2026-03-31' }) }),
      variant({ coach: '2', valid: validity({ from: '2026-04-01', to: '2026-04-30' }) }),
    );

    // A Wednesday in each period.
    expect(await chosen(departing('2026-03-11T10:00:00+01:00'))).toBe('1');
    expect(await chosen(departing('2026-04-15T10:00:00+02:00'))).toBe('2');
  });

  it('has none on a date outside every validity period', async () => {
    serve(
      variant({ coach: '1', valid: validity({ from: '2026-03-01', to: '2026-03-31' }) }),
      variant({ coach: '2', valid: validity({ from: '2026-04-01', to: '2026-04-30' }) }),
    );

    expect(await chosen(departing('2026-05-13T10:00:00+02:00'))).toBeNull();
  });

  // The page is for the 2026 timetable year: 14.12.2025 to 12.12.2026.
  it('reads an open start as the start of the timetable year', async () => {
    serve(variant({ coach: '1', valid: validity({ to: '2026-03-31' }) }));

    expect(await chosen(departing('2025-12-14T10:00:00+01:00'))).toBe('1');
    expect(await chosen(departing('2025-12-13T10:00:00+01:00'))).toBeNull();
  });

  it('reads an open end as the end of the timetable year', async () => {
    serve(variant({ coach: '1', valid: validity({ from: '2026-04-01' }) }));

    expect(await chosen(departing('2026-12-12T10:00:00+01:00'))).toBe('1');
    expect(await chosen(departing('2026-12-13T10:00:00+01:00'))).toBeNull();
  });

  const days = (...abbrs: readonly [title: string, text: string][]) =>
    abbrs.map(([title, text]) => `<abbr title="${title}">${text}</abbr>`).join(', ');

  // 11.03.2026 is a Wednesday, 14.03.2026 a Saturday.
  it('picks the variant that runs on the departure weekday', async () => {
    serve(
      variant({ coach: '1', valid: validity({ days: days(['Montag bis Freitag', 'Mo-Fr']) }) }),
      variant({
        coach: '2',
        valid: validity({ days: days(['Samstag', 'Sa'], ['Sonntag', 'So']) }),
      }),
    );

    expect(await chosen(departing('2026-03-11T10:00:00+01:00'))).toBe('1');
    expect(await chosen(departing('2026-03-14T10:00:00+01:00'))).toBe('2');
  });

  it('reads a list that mixes ranges and single days', async () => {
    serve(
      variant({
        coach: '1',
        valid: validity({ days: days(['Montag bis Dienstag, Samstag', 'Mo-Di, Sa']) }),
      }),
    );

    expect(await chosen(departing('2026-03-14T10:00:00+01:00'))).toBe('1');
    expect(await chosen(departing('2026-03-11T10:00:00+01:00'))).toBeNull();
  });

  it('never picks a variant whose operating days it does not understand', async () => {
    serve(
      variant({
        coach: '1',
        valid: validity({
          days: days(['Montag bis Freitag außer an Feiertagen', 'Mo-Fr außer ⚑']),
        }),
      }),
    );

    expect(await chosen(departing('2026-03-11T10:00:00+01:00'))).toBeNull();
  });

  it('tells variants valid on the same day apart by origin and destination', async () => {
    serve(
      variant({ coach: '1', origin: 'Musterstadt Hbf', destination: 'Beispielburg' }),
      variant({ coach: '2', origin: 'Nebenort', destination: 'Beispielburg' }),
      variant({ coach: '3', origin: 'Nebenort', destination: 'Fernhafen' }),
    );
    const on = (origin: string, destination: string) =>
      chosen(departing('2026-03-11T10:00:00+01:00', { origin, destination }));

    expect(await on('Musterstadt Hbf', 'Beispielburg')).toBe('1');
    expect(await on('Nebenort', 'Beispielburg')).toBe('2');
    expect(await on('Nebenort', 'Fernhafen')).toBe('3');
    expect(await on('Musterstadt Hbf', 'Fernhafen')).toBeNull();
  });

  it('has none while variants valid on the same day still cannot be told apart', async () => {
    serve(variant({ coach: '1' }), variant({ coach: '2' }));

    expect(await chosen(departing('2026-03-11T10:00:00+01:00'))).toBeNull();
  });

  it('has none among several variants when the origin is not known', async () => {
    serve(variant({ coach: '1' }), variant({ coach: '2', origin: 'Nebenort' }));
    expect(
      await chosen({
        train: { category: 'ICE', number: '700' },
        plannedDeparture: new Date('2026-03-11T10:00:00+01:00'),
        station: 'Mittelstadt',
        route: ['Zwischenhalt', 'Beispielburg'],
      }),
    ).toBeNull();
  });

  it('matches station names regardless of case, spacing, brackets and hyphens', async () => {
    serve(
      variant({ coach: '1', origin: 'Frankfurt (Main) Hbf', destination: 'Bad Beispiel-Ost' }),
      variant({ coach: '2', origin: 'Nebenort', destination: 'Bad Beispiel-Ost' }),
    );

    expect(
      await chosen(
        departing('2026-03-11T10:00:00+01:00', {
          origin: 'Frankfurt(Main)Hbf',
          destination: 'bad beispielost',
        }),
      ),
    ).toBe('1');
  });

  it('has none when a station name genuinely differs', async () => {
    serve(
      variant({ coach: '1', origin: 'Frankfurt (Main) Hbf' }),
      variant({ coach: '2', origin: 'Nebenort' }),
    );

    expect(
      await chosen(departing('2026-03-11T10:00:00+01:00', { origin: 'Frankfurt(M)Hbf' })),
    ).toBeNull();
  });

  // 00:10 in Berlin on Saturday 14.03.2026 is still Friday 13.03.2026 in UTC.
  it('takes the departure date in Berlin local time', async () => {
    serve(
      variant({ coach: '1', valid: validity({ days: days(['Freitag', 'Fr']) }) }),
      variant({ coach: '2', valid: validity({ days: days(['Samstag', 'Sa']) }) }),
      variant({ coach: '3', valid: validity({ to: '2026-03-13' }) }),
    );

    expect(await chosen(departing('2026-03-13T23:10:00Z'))).toBe('2');
  });

  it('has none for an open validity when the page names no timetable year', async () => {
    const withoutYear = page(
      variant({ coach: '1', number: '700', valid: validity({ to: '2026-03-31' }) }),
      variant({ coach: '2', number: '701' }),
      variant({
        coach: '3',
        number: '702',
        valid: validity({ from: '2026-03-01', to: '2026-03-31' }),
      }),
    ).replace(/<form>[\s\S]*<\/form>/, '');
    serving(() => Promise.resolve(new Response(withoutYear, { status: 200 })));
    const on = (number: string) =>
      chosen({ ...departing('2026-03-11T10:00:00+01:00'), train: { category: 'ICE', number } });

    expect(await on('700')).toBeNull();
    expect(await on('701')).toBeNull();
    expect(await on('702')).toBe('3');
  });

  it('takes an entry without a validity line as valid the whole timetable year', async () => {
    serve(variant({ coach: '1' }));

    expect(await chosen(departing('2025-12-14T10:00:00+01:00'))).toBe('1');
    expect(await chosen(departing('2026-12-12T10:00:00+01:00'))).toBe('1');
    expect(await chosen(departing('2026-12-13T10:00:00+01:00'))).toBeNull();
  });
});
