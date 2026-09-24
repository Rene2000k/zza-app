import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveRouteChanges,
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
    const changed = parseElement('<dp cpth="" ct="2609101545" cs="c" clt="2609101521" l="RB34"/>');
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
    expect(
      resolvePathNames(parseElement('<dp ppth="Dortelweil|Groß Karben"/>'), undefined),
    ).toEqual(['Dortelweil', 'Groß Karben']);
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
    expect(mapMessage(parseElement('<m t="h" cat="Information"/>'))).toMatchObject({
      kind: 'info',
    });
    expect(mapMessage(parseElement('<m t="h" cat="Bauarbeiten"/>'))).toMatchObject({
      kind: 'constraint',
    });
  });

  it('resolves a quality code to its text and topic', () => {
    // Real fragment from the Bad Vilbel capture, the most frequent q code there.
    expect(mapMessage(parseElement('<m t="q" c="85" ts="2609100219"/>'))).toEqual({
      kind: 'qualityNotice',
      code: '85',
      topic: 'missingCoaches',
      text: 'Ein Wagen fehlt',
    });
    expect(mapMessage(parseElement('<m t="q" c="82"/>'))).toEqual({
      kind: 'qualityNotice',
      code: '82',
      topic: 'missingCoaches',
      text: 'Mehrere Wagen fehlen',
    });
  });

  it('files quality codes under the topic a design selects by, not under their number', () => {
    const topicOf = (code: string): string | undefined => {
      const message = mapMessage(parseElement(`<m t="q" c="${code}"/>`));
      return message?.kind === 'qualityNotice' ? message.topic : undefined;
    };
    expect(topicOf('80')).toBe('coachOrder');
    expect(topicOf('91')).toBe('bicycle');
    expect(topicOf('90')).toBe('catering');
    expect(topicOf('95')).toBe('accessibility');
    expect(topicOf('70')).toBe('onboardServices');
    expect(topicOf('86')).toBe('reservation');
    expect(topicOf('97')).toBe('occupancy');
    expect(topicOf('78')).toBe('busReplacement');
    expect(topicOf('98')).toBe('other');
  });

  it('resolves code 99, which the source sends as both a delay cause and a quality notice', () => {
    // Live at Munchen Hbf on 2026-09-23: six t="d" c="99". A code above the range delay
    // causes otherwise keep to must still resolve, or those messages lose their text.
    expect(mapMessage(parseElement('<m t="d" c="99"/>'))).toEqual({
      kind: 'delayCause',
      code: '99',
      text: 'Verzögerungen im Betriebsablauf',
    });
    expect(mapMessage(parseElement('<m t="q" c="99"/>'))).toEqual({
      kind: 'qualityNotice',
      code: '99',
      topic: 'other',
      text: 'Verzögerungen im Betriebsablauf',
    });
  });

  it('discards the codes that only withdraw an earlier notice', () => {
    // 84/88/89 revoke rather than state; ADR-0011 discards them without acting on them, so
    // none of them may reach a display as "Zug verkehrt richtig gereiht".
    expect(mapMessage(parseElement('<m t="q" c="84"/>'))).toBeUndefined();
    expect(mapMessage(parseElement('<m t="q" c="88"/>'))).toBeUndefined();
    expect(mapMessage(parseElement('<m t="q" c="89"/>'))).toBeUndefined();
  });

  it('contributes nothing for an unknown quality code', () => {
    // Unlike a delay cause, which keeps its code without text: without a topic there is
    // nothing to select the message by, so it is not produced at all.
    expect(mapMessage(parseElement('<m t="q" c="9999"/>'))).toBeUndefined();
    // A quality code below the observed 70-99 range is unknown too, and stays silent.
    expect(mapMessage(parseElement('<m t="q" c="43"/>'))).toBeUndefined();
  });

  it('contributes nothing for an unrecognized message type', () => {
    // t="f"/"c"/... have no confirmed display meaning (ADR-0002) — real fragment.
    expect(mapMessage(parseElement('<m t="f" c="0"/>'))).toBeUndefined();
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

  it('maps a real delay whose only messages are quality notices', () => {
    // RB 15735: 6 minutes late (16:58 -> 17:04 planned), its only messages are t="q" c="85",
    // arriving twice under different ids — the delay and the notices must both survive.
    const entry = asDeparture(entries.find((e) => e.id === '760501916431835347-2609101607-14'));
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(entry.status).toBe('delayed');
    expect(entry.messages).toEqual([
      { kind: 'qualityNotice', code: '85', topic: 'missingCoaches', text: 'Ein Wagen fehlt' },
      { kind: 'qualityNotice', code: '85', topic: 'missingCoaches', text: 'Ein Wagen fehlt' },
    ]);
    expect(entry.destination.name).toBe('Frankfurt(Main)Hbf');
    expect(entry.via.map((s) => s.name)).toEqual(['Frankfurt(Main)West']);
  });
});

describe('deriveRouteChanges', () => {
  /**
   * Every case here is a real route pair taken from paired plan/fchg captures — the shapes a
   * busy station actually produces in one evening.
   */
  const names = (changes: ReturnType<typeof deriveRouteChanges>, kind: string): string[] =>
    changes.find((c) => c.kind === kind)?.stops.map((s) => s.name) ?? [];

  it('reports a stop the train passes through without calling', () => {
    const planned = ['Frankfurt(Main)Süd', 'Offenbach(Main)Hbf', 'Hanau Hbf', 'Gelnhausen'];
    const changed = ['Frankfurt(Main)Süd', 'Hanau Hbf', 'Gelnhausen'];
    expect(deriveRouteChanges(planned, changed)).toEqual([
      { kind: 'skippedStops', stops: [{ name: 'Offenbach(Main)Hbf' }] },
    ]);
  });

  it('reports stops dropped from the front as skipped, not as ending early', () => {
    // The train still runs to the end; it just no longer calls at the first two stops. A
    // "head" drop on a departure path is the same case as a drop in the middle.
    const planned = ['Wunstorf', 'Neustadt am Rübenberge', 'Nienburg(Weser)', 'Eystrup'];
    const changed = ['Nienburg(Weser)', 'Eystrup'];
    const changes = deriveRouteChanges(planned, changed);
    expect(changes.map((c) => c.kind)).toEqual(['skippedStops']);
    expect(names(changes, 'skippedStops')).toEqual(['Wunstorf', 'Neustadt am Rübenberge']);
  });

  it('reports a trailing run as ending early', () => {
    const planned = ['Wunstorf', 'Poggenhagen', 'Neustadt am Rübenberge', 'Eilvese', 'Hagen(Han)', 'Linsburg', 'Nienburg(Weser)'];
    const changed = ['Wunstorf', 'Poggenhagen', 'Neustadt am Rübenberge'];
    const changes = deriveRouteChanges(planned, changed);
    expect(changes.map((c) => c.kind)).toEqual(['endsEarly']);
    // No spurious skippedStops, and the last name is the terminus the timetable promised.
    expect(names(changes, 'endsEarly')).toEqual(['Eilvese', 'Hagen(Han)', 'Linsburg', 'Nienburg(Weser)']);
  });

  it('reports an inserted stop', () => {
    const planned = ['Hannover Hbf', 'Celle', 'Hamburg Hbf'];
    const changed = ['Hannover Hbf', 'Celle', 'Hamburg-Harburg', 'Hamburg Hbf'];
    expect(deriveRouteChanges(planned, changed)).toEqual([
      { kind: 'additionalStops', stops: [{ name: 'Hamburg-Harburg' }] },
    ]);
  });

  it('reports a diversion as skipped plus additional, not as a case of its own', () => {
    const planned = ['Dortmund Hbf', 'Gelsenkirchen Hbf', 'Duisburg Hbf', 'Düsseldorf Hbf', 'Köln Hbf'];
    const changed = ['Dortmund Hbf', 'Solingen Hbf', 'Köln Hbf'];
    const changes = deriveRouteChanges(planned, changed);
    expect(changes.map((c) => c.kind)).toEqual(['skippedStops', 'additionalStops']);
    expect(names(changes, 'skippedStops')).toEqual(['Gelsenkirchen Hbf', 'Duisburg Hbf', 'Düsseldorf Hbf']);
    expect(names(changes, 'additionalStops')).toEqual(['Solingen Hbf']);
    // The destination is untouched, so nothing may claim the train ends early.
    expect(names(changes, 'endsEarly')).toEqual([]);
  });

  it('names every skipped stop, however many', () => {
    const planned = ['Nienburg(Weser)', 'Verden(Aller)', 'Bremen Hbf', 'Delmenhorst', 'Hude', 'Oldenburg(Oldb)Hbf', 'Bad Zwischenahn', 'Westerstede-Ocholt', 'Augustfehn', 'Leer(Ostfriesl)', 'Emden Hbf', 'Norddeich'];
    const changed = ['Osnabrück Hbf', 'Leer(Ostfriesl)', 'Emden Hbf', 'Norddeich'];
    const changes = deriveRouteChanges(planned, changed);
    expect(names(changes, 'skippedStops')).toHaveLength(9);
    expect(names(changes, 'additionalStops')).toEqual(['Osnabrück Hbf']);
  });

  it('separates stops skipped along the way from the run it no longer reaches', () => {
    const planned = ['A', 'B', 'C', 'D', 'E'];
    const changed = ['A', 'C'];
    expect(deriveRouteChanges(planned, changed)).toEqual([
      { kind: 'skippedStops', stops: [{ name: 'B' }] },
      { kind: 'endsEarly', stops: [{ name: 'D' }, { name: 'E' }] },
    ]);
  });

  it('does not also call the new terminus an additional stop', () => {
    // A route replaced outright, with no station in common. Reporting the new terminus as an
    // extra call as well would have the display say "Heute nur bis X" and "Heute mit
    // zusätzlichem Halt in X" at once.
    const changes = deriveRouteChanges(['Bremen Hbf'], ['Minden(Westf)']);
    expect(changes).toEqual([{ kind: 'endsEarly', stops: [{ name: 'Bremen Hbf' }] }]);
  });

  it('still reports an added stop that is not the new terminus', () => {
    const changes = deriveRouteChanges(['A', 'B', 'C'], ['A', 'X', 'B']);
    expect(changes).toEqual([
      { kind: 'endsEarly', stops: [{ name: 'C' }] },
      { kind: 'additionalStops', stops: [{ name: 'X' }] },
    ]);
  });

  it('keeps a stop beyond the planned destination as an additional stop', () => {
    // Nothing is dropped here, so the train is not ending early and the extra call stands.
    expect(deriveRouteChanges(['A', 'B'], ['A', 'B', 'C'])).toEqual([
      { kind: 'additionalStops', stops: [{ name: 'C' }] },
    ]);
  });

  it('reports nothing when the route is unchanged, or when either path is missing', () => {
    expect(deriveRouteChanges(['A', 'B'], ['A', 'B'])).toEqual([]);
    // No cpth at all means the source reported no deviation.
    expect(deriveRouteChanges(['A', 'B'], [])).toEqual([]);
    expect(deriveRouteChanges([], ['A'])).toEqual([]);
  });
});

describe('mapBoardEntries: withdrawn quality notices', () => {
  /**
   * The shapes here follow live responses for Frankfurt Hbf and Munchen Hbf (2026-09-23),
   * where code 88 turned out to be common: 17 across the two stations, and on 8 stops it
   * followed a notice that was still standing.
   */
  const planDoc = parseDoc(
    "<timetable station='Frankfurt(Main)Hbf'>" +
      '<s id="stop-1">' +
      '<tl f="N" t="p" o="800640" c="RE" n="4263"/>' +
      '<dp pt="2609231100" pp="9" l="RE2" ppth="Mainz Hbf|Koblenz Hbf"/>' +
      '</s></timetable>',
  );

  const changesWith = (messages: string): Document =>
    parseDoc(
      "<timetable station='Frankfurt(Main)Hbf'>" +
        '<s id="stop-1">' +
        messages +
        '</s></timetable>',
    );

  const quality = (entry: BoardEntry | undefined) =>
    (entry?.messages ?? []).filter((m) => m.kind === 'qualityNotice');

  it('drops a notice that code 88 withdrew afterwards', () => {
    // The Frankfurt case: 95 at 10:48, then 88 at 11:05.
    const fchg = changesWith(
      '<m id="r1" t="q" c="95" ts="2609231048"/><m id="r2" t="q" c="88" ts="2609231105"/>',
    );
    const [entry] = mapBoardEntries([planDoc], fchg);
    expect(quality(entry)).toEqual([]);
  });

  it('keeps a notice the source restated at the moment it withdrew', () => {
    // The Munchen case: 95 (02:44), 88 (02:46), 95 (02:46). The restatement must survive,
    // which is why the comparison is strictly earlier rather than up to and including.
    const fchg = changesWith(
      '<m id="r1" t="q" c="95" ts="2609230244"/>' +
        '<m id="r2" t="q" c="88" ts="2609230246"/>' +
        '<m id="r3" t="q" c="95" ts="2609230246"/>',
    );
    const [entry] = mapBoardEntries([planDoc], fchg);
    expect(quality(entry)).toEqual([
      {
        kind: 'qualityNotice',
        code: '95',
        topic: 'accessibility',
        text: 'Universaltoilette fehlt',
      },
    ]);
  });

  it('keeps a notice the source raised after the withdrawal', () => {
    const fchg = changesWith(
      '<m id="r1" t="q" c="88" ts="2609231000"/><m id="r2" t="q" c="85" ts="2609231130"/>',
    );
    const [entry] = mapBoardEntries([planDoc], fchg);
    expect(quality(entry)).toEqual([
      { kind: 'qualityNotice', code: '85', topic: 'missingCoaches', text: 'Ein Wagen fehlt' },
    ]);
  });

  it('lets code 84 withdraw only the coach order, leaving other topics standing', () => {
    const fchg = changesWith(
      '<m id="r1" t="q" c="80" ts="2609231000"/>' +
        '<m id="r2" t="q" c="91" ts="2609231000"/>' +
        '<m id="r3" t="q" c="84" ts="2609231100"/>',
    );
    const [entry] = mapBoardEntries([planDoc], fchg);
    expect(quality(entry)).toEqual([
      {
        kind: 'qualityNotice',
        code: '91',
        topic: 'bicycle',
        text: 'Fahrradmitnahme nicht möglich',
      },
    ]);
  });

  it('lets code 89 withdraw only reservations', () => {
    const fchg = changesWith(
      '<m id="r1" t="q" c="86" ts="2609231000"/>' +
        '<m id="r2" t="q" c="85" ts="2609231000"/>' +
        '<m id="r3" t="q" c="89" ts="2609231100"/>',
    );
    const [entry] = mapBoardEntries([planDoc], fchg);
    expect(quality(entry)).toEqual([
      { kind: 'qualityNotice', code: '85', topic: 'missingCoaches', text: 'Ein Wagen fehlt' },
    ]);
  });

  it('withdraws nothing when the withdrawal carries no timestamp', () => {
    // Without a ts the withdrawal cannot be placed in the sequence, so guessing is worse
    // than leaving the notice standing.
    const fchg = changesWith(
      '<m id="r1" t="q" c="85" ts="2609231000"/><m id="r2" t="q" c="88"/>',
    );
    const [entry] = mapBoardEntries([planDoc], fchg);
    expect(quality(entry)).toHaveLength(1);
  });

  it('leaves delay causes alone, whatever the quality notices say', () => {
    const fchg = changesWith(
      '<m id="r1" t="d" c="43" ts="2609231000"/><m id="r2" t="q" c="88" ts="2609231100"/>',
    );
    const [entry] = mapBoardEntries([planDoc], fchg);
    expect(entry?.messages).toEqual([
      { kind: 'delayCause', code: '43', text: 'Verspätung eines vorausfahrenden Zuges' },
    ]);
  });
});

describe('mapBoardEntries: route changes', () => {
  const planDoc = parseDoc(
    "<timetable station='Frankfurt(Main)Hbf'>" +
      '<s id="stop-1">' +
      '<tl f="N" t="p" o="800640" c="RE" n="4534"/>' +
      '<dp pt="2609231100" pp="9" l="RE50" ppth="Frankfurt(Main)Süd|Offenbach(Main)Hbf|Hanau Hbf|Gelnhausen"/>' +
      '</s></timetable>',
  );

  const changesWith = (dp: string): Document =>
    parseDoc("<timetable station='Frankfurt(Main)Hbf'><s id=\"stop-1\">" + dp + '</s></timetable>');

  it('derives the change and leaves the via line reporting the route actually taken', () => {
    const fchg = changesWith('<dp cpth="Frankfurt(Main)Süd|Hanau Hbf|Gelnhausen" ct="2609231100"/>');
    const entry = asDeparture(mapBoardEntries([planDoc], fchg)[0]);
    expect(entry?.routeChanges).toEqual([
      { kind: 'skippedStops', stops: [{ name: 'Offenbach(Main)Hbf' }] },
    ]);
    // ADR-0005 governs the via line; this decision adds a statement, it does not alter it.
    expect(entry?.via.map((s) => s.name)).toEqual(['Frankfurt(Main)Süd', 'Hanau Hbf']);
    expect(entry?.destination.name).toBe('Gelnhausen');
  });

  it('reports no route change for a cancelled departure that still carries a differing path', () => {
    // A good number of cancelled departures look exactly like this. Keying on an empty cpth
    // instead of on cs would announce skipped stops for a train that does not run.
    const fchg = changesWith('<dp cpth="Frankfurt(Main)Süd|Gelnhausen" cs="c" clt="2609220203"/>');
    const entry = asDeparture(mapBoardEntries([planDoc], fchg)[0]);
    expect(entry?.status).toBe('cancelled');
    expect(entry?.routeChanges).toEqual([]);
  });

  it('reports no route change for a cancelled departure whose path was wiped', () => {
    const fchg = changesWith('<dp cpth="" cs="c" clt="2609220203"/>');
    const entry = asDeparture(mapBoardEntries([planDoc], fchg)[0]);
    expect(entry?.status).toBe('cancelled');
    expect(entry?.routeChanges).toEqual([]);
    // The emptied path still falls back to the plan, so the destination survives.
    expect(entry?.destination.name).toBe('Gelnhausen');
  });

  it('reports no route change when the source sent no changed path at all', () => {
    const fchg = changesWith('<dp ct="2609231105"/>');
    const entry = asDeparture(mapBoardEntries([planDoc], fchg)[0]);
    expect(entry?.routeChanges).toEqual([]);
  });
});

describe('mapBoardEntries: terminating and originating stops (real Frankfurt fragments)', () => {
  const emptyFchg = parseDoc('<timetable station="Frankfurt(Main)Hbf" eva="8000105"></timetable>');

  it('maps an arrival-only stop as a terminating arrival (ADR-0003)', () => {
    const planDoc = parseDoc(
      "<timetable station='Frankfurt(Main)Hbf'>" +
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
    expect(terminating.train).toEqual({
      category: 'RE',
      number: '4263',
      line: 'RE2',
      operator: '800640',
    });
    // Route stops carry no EVA number: IRIS names them only.
    expect(terminating.origin).toEqual({ name: 'Koblenz Hbf' });
    expect(terminating.time.planned).toEqual(new Date('2026-09-10T14:51:00Z'));
  });

  it('maps a departure-only stop as an originating departure', () => {
    const planDoc = parseDoc(
      "<timetable station='Frankfurt(Main)Hbf'>" +
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
