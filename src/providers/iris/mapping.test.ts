import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  mapBoardEntries,
  mapMessage,
  mapStationDetails,
  resolvePathNames,
  resolvePlatform,
  resolveStatus,
  resolveTime,
} from './mapping';
import type { BoardEntry, DepartureEntry, TerminatingArrivalEntry } from '@/domain/boardEntry';

const asDeparture = (entry: BoardEntry | undefined): DepartureEntry | undefined =>
  entry?.kind === 'departure' ? entry : undefined;

const asTerminating = (entry: BoardEntry | undefined): TerminatingArrivalEntry | undefined =>
  entry?.kind === 'terminatingArrival' ? entry : undefined;

/**
 * All XML here is real IRIS output, not hand-authored fixtures — either the two full
 * captures under `__fixtures__/` (Bad Vilbel, 2026-09-10) or a single verbatim `<s>`
 * block extracted from one, so an adapter bug — or a change in the source's format —
 * shows up against the source's actual shape rather than against a guess at it.
 */

const fixture = (name: string): string =>
  readFileSync(join(process.cwd(), 'src/providers/iris/__fixtures__', name), 'utf-8');

const parseDoc = (xml: string): Document => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`invalid test XML: ${xml}`);
  }
  return doc;
};

/** Parses one standalone element fragment, e.g. `<ar pt="..." pp="9"/>`. */
const parseElement = (xml: string): Element => parseDoc(xml).documentElement;

describe('resolveTime', () => {
  it('takes the planned time when nothing changed it', () => {
    const time = resolveTime(parseElement('<dp pt="2609101610" pp="3"/>'), undefined);
    expect(time).toEqual({
      planned: new Date('2026-09-10T14:10:00Z'),
      expected: new Date('2026-09-10T14:10:00Z'),
    });
  });

  it('takes the changed time when present — real delay from the RB 15735 fixture', () => {
    const planned = parseElement('<dp pt="2609101658" pp="5"/>');
    const changed = parseElement('<dp ct="2609101704" l="RB34"/>');
    expect(resolveTime(planned, changed)).toEqual({
      planned: new Date('2026-09-10T14:58:00Z'),
      expected: new Date('2026-09-10T15:04:00Z'),
    });
  });

  it('reports no time when the planned element carries none', () => {
    expect(resolveTime(parseElement('<dp pp="3"/>'), undefined)).toBeUndefined();
  });
});

describe('resolvePlatform', () => {
  it('uses the planned platform when nothing changed it', () => {
    expect(resolvePlatform(parseElement('<dp pt="2609101610" pp="3"/>'), undefined)).toEqual({
      planned: '3',
      actual: '3',
      changed: false,
    });
  });

  it('marks a real platform change — cp="3" from the Bad Vilbel S6 fixture', () => {
    const planned = parseElement('<ar pt="2609101222" pp="1"/>');
    const changed = parseElement(
      '<ar cpth="Darmstadt Hbf|Darmstadt-Arheilgen" cp="3" ct="2609101222" l="S6"/>',
    );
    expect(resolvePlatform(planned, changed)).toEqual({ planned: '1', actual: '3', changed: true });
  });
});

describe('resolveStatus', () => {
  const onTime = resolveTime(parseElement('<dp pt="2609101610"/>'), undefined);
  if (onTime === undefined) throw new Error('test setup: expected a time');

  it('is onTime with no changed element', () => {
    expect(resolveStatus(undefined, onTime)).toBe('onTime');
  });

  it('is cancelled on cs="c" — the real RB34 cancellation fragment', () => {
    const changed = parseElement(
      '<dp cpth="" ct="2609101545" cs="c" clt="2609101521" l="RB34"/>',
    );
    expect(resolveStatus(changed, onTime)).toBe('cancelled');
  });

  it('is delayed once the changed time is later than planned', () => {
    const planned = parseElement('<dp pt="2609101658"/>');
    const time = resolveTime(planned, parseElement('<dp ct="2609101704"/>'));
    if (time === undefined) throw new Error('test setup: expected a time');
    expect(resolveStatus(parseElement('<dp ct="2609101704"/>'), time)).toBe('delayed');
  });
});

describe('resolvePathNames', () => {
  it('splits the planned path', () => {
    expect(resolvePathNames(parseElement('<dp ppth="Dortelweil|Groß Karben"/>'), undefined)).toEqual([
      'Dortelweil',
      'Groß Karben',
    ]);
  });

  it('prefers a non-empty changed path over the planned one', () => {
    const planned = parseElement('<ar ppth="A|B"/>');
    const changed = parseElement('<ar cpth="A|C"/>');
    expect(resolvePathNames(planned, changed)).toEqual(['A', 'C']);
  });

  it('falls back to the planned path when the changed path is empty (cancellation)', () => {
    // Real shape: a cancelled movement reports cpth="" rather than omitting it.
    const planned = parseElement('<ar ppth="Darmstadt Hbf|Darmstadt-Arheilgen"/>');
    const changed = parseElement('<ar cpth="" cs="c"/>');
    expect(resolvePathNames(planned, changed)).toEqual(['Darmstadt Hbf', 'Darmstadt-Arheilgen']);
  });

  it('is empty when neither path is present', () => {
    expect(resolvePathNames(parseElement('<ar/>'), undefined)).toEqual([]);
  });
});

describe('mapMessage', () => {
  it('resolves a known delay-cause code', () => {
    expect(mapMessage(parseElement('<m t="d" c="43"/>'))).toEqual({
      kind: 'delayCause',
      code: '43',
      text: 'Verspätung eines vorausfahrenden Zuges',
    });
  });

  it('keeps an unresolved code without inventing text', () => {
    expect(mapMessage(parseElement('<m t="d" c="9999"/>'))).toEqual({
      kind: 'delayCause',
      code: '9999',
    });
  });

  it('maps a HIM message by category, carrying its priority', () => {
    expect(mapMessage(parseElement('<m t="h" cat="Störung" pr="1"/>'))).toEqual({
      kind: 'disruption',
      text: 'Störung',
      priority: 1,
    });
    expect(mapMessage(parseElement('<m t="h" cat="Information"/>'))).toMatchObject({ kind: 'info' });
    expect(mapMessage(parseElement('<m t="h" cat="Bauarbeiten"/>'))).toMatchObject({
      kind: 'constraint',
    });
  });

  it('contributes nothing for an unrecognized message type', () => {
    // t="f"/"q"/"c"/... have no confirmed display meaning (ADR-0002) — real fragment.
    expect(mapMessage(parseElement('<m t="q" c="85"/>'))).toBeUndefined();
  });
});

describe('mapBoardEntries against real captures', () => {
  const planDoc = parseDoc(fixture('plan-8000760-260910-16.xml'));
  const fchgDoc = parseDoc(fixture('fchg-8000760.xml'));
  const entries = mapBoardEntries([planDoc], fchgDoc);

  it('maps every stop in the plan hour', () => {
    expect(entries).toHaveLength(13);
    expect(entries.every((entry) => entry.kind === 'departure')).toBe(true);
  });

  it('maps a delayed train whose messages carry a resolved and an unresolved-by-us HIM category', () => {
    // S 35649: ct equals pt (no actual delay) despite carrying delay-cause messages —
    // status must follow the time, not the mere presence of a message.
    const entry = asDeparture(entries.find((e) => e.id === '3481204367366231488-2609101550-7'));
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(entry.status).toBe('onTime');
    expect(entry.platform).toEqual({ planned: '3', actual: '3', changed: false });
    expect(entry.destination.name).toBe('Langen(Hess)');
    expect(entry.via).toHaveLength(20);
    expect(entry.via[0]?.name).toBe('Bad Vilbel Süd');
    expect(entry.messages).toContainEqual({
      kind: 'delayCause',
      code: '43',
      text: 'Verspätung eines vorausfahrenden Zuges',
    });
    expect(entry.messages).toContainEqual({
      kind: 'delayCause',
      code: '14',
      text: 'Technischer Defekt am Bahnhof',
    });
    expect(entry.messages.filter((m) => m.kind === 'disruption')).toHaveLength(2);
  });

  it('maps a real delay with an unmapped message type as an empty message list', () => {
    // RB 15735: 6 minutes late (16:58 -> 17:04 planned), its only messages are t="q",
    // which this adapter does not resolve — the delay must still show without them.
    const entry = asDeparture(entries.find((e) => e.id === '760501916431835347-2609101607-14'));
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(entry.status).toBe('delayed');
    expect(entry.messages).toEqual([]);
    expect(entry.destination.name).toBe('Frankfurt(Main)Hbf');
    expect(entry.via.map((s) => s.name)).toEqual(['Frankfurt(Main)West']);
  });
});

describe('mapBoardEntries: terminating and originating stops (real Frankfurt fragments)', () => {
  const emptyFchg = parseDoc('<timetable station="Frankfurt(Main)Hbf" eva="8000105"></timetable>');

  it('maps an arrival-only stop as a terminating arrival (ADR-0003)', () => {
    const planDoc = parseDoc(
      '<timetable station=\'Frankfurt(Main)Hbf\'>' +
        '<s id="-2052222982576990269-2609101504-14">' +
        '<tl f="N" t="p" o="800640" c="RE" n="4263"/>' +
        '<ar pt="2609101651" pp="19" l="RE2" fb="RE2" ' +
        'ppth="Koblenz Hbf|Boppard Hbf|Oberwesel|Bacharach|Bingen(Rhein) Hbf|Gau Algesheim|' +
        'Ingelheim|Mainz Hbf|Mainz Römisches Theater|Mainz-Bischofsheim|Rüsselsheim|' +
        'Frankfurt(M) Flughafen Regionalbf|Frankfurt-Niederrad"/>' +
        '</s></timetable>',
    );
    const [entry] = mapBoardEntries([planDoc], emptyFchg);
    const terminating = asTerminating(entry);
    expect(terminating).toBeDefined();
    if (terminating === undefined) return;
    expect(terminating.train).toEqual({ category: 'RE', number: '4263', line: 'RE2', operator: '800640' });
    // Route stops carry no EVA number: IRIS names them only.
    expect(terminating.origin).toEqual({ name: 'Koblenz Hbf' });
    expect(terminating.time.planned).toEqual(new Date('2026-09-10T14:51:00Z'));
  });

  it('maps a departure-only stop as an originating departure', () => {
    const planDoc = parseDoc(
      '<timetable station=\'Frankfurt(Main)Hbf\'>' +
        '<s id="-5269309676411018437-2609101634-1">' +
        '<tl f="S" t="p" o="800528" c="S" n="36854"/>' +
        '<dp pt="2609101634" pp="19" l="S8" fb="S8" ' +
        'ppth="Frankfurt-Niederrad|Frankfurt am Main - Stadion|Frankfurt(Main)-Gateway Gardens|' +
        'Frankfurt(M) Flughafen Regionalbf|Kelsterbach"/>' +
        '</s></timetable>',
    );
    const [entry] = mapBoardEntries([planDoc], emptyFchg);
    const departure = asDeparture(entry);
    expect(departure).toBeDefined();
    if (departure === undefined) return;
    expect(departure.destination).toEqual({ name: 'Kelsterbach' });
    expect(departure.via.map((s) => s.name)).toEqual([
      'Frankfurt-Niederrad',
      'Frankfurt am Main - Stadion',
      'Frankfurt(Main)-Gateway Gardens',
      'Frankfurt(M) Flughafen Regionalbf',
    ]);
  });
});

describe('mapStationDetails', () => {
  it('maps a station with a platform list', () => {
    const doc = parseDoc(fixture('station-8000760.xml'));
    expect(mapStationDetails(doc)).toEqual([
      { evaNumber: '8000760', name: 'Bad Vilbel', ds100: 'FVL', platforms: ['1', '2', '3'] },
    ]);
  });

  it('returns no results for an empty response', () => {
    expect(mapStationDetails(parseDoc('<stations></stations>'))).toEqual([]);
  });
});