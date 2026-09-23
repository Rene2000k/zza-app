import { parseIrisTimestamp } from './berlinTime';
import { ALL_TOPICS, resolveDelayCause, resolveQuality, resolveRevocation } from './messageCodes';
import { isDelayed } from '@/domain/boardEntry';
import type { BoardEntry, DepartureEntry, EntryStatus, EntryTime, PlatformInfo, TerminatingArrivalEntry } from '@/domain/boardEntry';
import type { Revocation } from './messageCodes';
import type { BoardMessage, PlainMessageKind, QualityTopic } from '@/domain/message';
import type { RouteStop, StationDetails } from '@/domain/station';
import type { TrainRef } from '@/domain/train';

/**
 * Maps XML to domain model, field by field
 *
 * Two structural rules apply throughout, both following from how IRIS itself is shaped
 * (ADR-0002: `plan` is the schedule, `fchg` the live deviations, joined by stop `id`):
 *
 * - A changed (`c*`) attribute overrides its planned counterpart wherever present, with
 *   one exception: an empty `cpth` (seen on cancellations, where the remaining path is
 *   wiped) falls back to the planned path, so a cancelled train still shows where it was
 *   headed instead of a blank destination.
 * - IRIS's via/destination/origin path (`ppth`/`cpth`) is a list of station *names*
 *   only, never EVA numbers — resolving each would cost one lookup per name. These
 *   stops are therefore `RouteStop`s without an EVA number; only the board's
 *   own station carries one.
 */

const children = (el: Element, tag: string): Element[] =>
  Array.from(el.children).filter((child) => child.tagName === tag);

const child = (el: Element, tag: string): Element | undefined => children(el, tag)[0];

const routeStop = (name: string): RouteStop => ({ name });

const preferChanged = (planned: Element, changed: Element | undefined, attr: string): string | undefined =>
  changed?.getAttribute(attr) ?? planned.getAttribute(attr) ?? undefined;

export const resolveTime = (planned: Element, changed: Element | undefined): EntryTime | undefined => {
  const plannedRaw = planned.getAttribute('pt');
  if (plannedRaw === null) return undefined;
  const changedRaw = changed?.getAttribute('ct') ?? null;
  return {
    planned: parseIrisTimestamp(plannedRaw),
    expected: changedRaw === null ? parseIrisTimestamp(plannedRaw) : parseIrisTimestamp(changedRaw),
  };
};

export const resolvePlatform = (planned: Element, changed: Element | undefined): PlatformInfo => {
  const plannedPlatform = planned.getAttribute('pp') ?? undefined;
  const changedPlatform = changed?.getAttribute('cp') ?? undefined;
  const actual = changedPlatform ?? plannedPlatform;
  return {
    ...(plannedPlatform === undefined ? {} : { planned: plannedPlatform }),
    ...(actual === undefined ? {} : { actual }),
    changed: changedPlatform !== undefined,
  };
};

const isCancelled = (changed: Element | undefined): boolean => changed?.getAttribute('cs') === 'c';

export const resolveStatus = (changed: Element | undefined, time: EntryTime): EntryStatus => {
  // 'diverted' and 'replacement' are not produced by this adapter: IRIS gives no
  // reliable signal for either that was confirmed against live data, so guessing would
  // mean showing a status the source never actually stated.
  if (isCancelled(changed)) return 'cancelled';
  return isDelayed(time) ? 'delayed' : 'onTime';
};

/** The via/destination/origin path for one movement: changed path wins when non-empty. */
export const resolvePathNames = (planned: Element, changed: Element | undefined): string[] => {
  const changedRaw = changed?.getAttribute('cpth');
  const raw = changedRaw !== null && changedRaw !== undefined && changedRaw !== '' ? changedRaw : (planned.getAttribute('ppth') ?? '');
  return raw === '' ? [] : raw.split('|');
};

const himKind = (cat: string): PlainMessageKind => {
  if (cat === 'Information') return 'info';
  if (cat === 'Bauarbeiten') return 'constraint';
  // Covers "Störung" and any other/unknown category: real source text, shown as-is
  // rather than hidden, since only the *kind* classification is a guess here.
  return 'disruption';
};

export const mapMessage = (m: Element): BoardMessage | undefined => {
  const type = m.getAttribute('t');
  if (type === 'd') {
    const code = m.getAttribute('c');
    if (code === null) return undefined;
    const text = resolveDelayCause(code);
    return { kind: 'delayCause', code, ...(text === undefined ? {} : { text }) };
  }
  if (type === 'h') {
    const cat = m.getAttribute('cat');
    if (cat === null) return undefined;
    const priority = m.getAttribute('pr');
    return {
      kind: himKind(cat),
      text: cat,
      ...(priority === null ? {} : { priority: Number(priority) }),
    };
  }
  if (type === 'q') {
    const code = m.getAttribute('c');
    if (code === null) return undefined;
    // Unlike a delay cause, an unresolved quality code yields no message at all: without a
    // topic there is nothing for a design to select it by, and no text to print (ADR-0011).
    const resolved = resolveQuality(code);
    if (resolved === undefined) return undefined;
    return { kind: 'qualityNotice', code, topic: resolved.topic, text: resolved.text };
  }
  // Every other type seen in live data (c, e, f, p, r, s) has no confirmed,
  // display-worthy meaning (ADR-0002 established d and h, ADR-0011 added q) — contributing
  // nothing is safer than guessing a kind for it.
  return undefined;
};

/**
 * When each topic was last declared settled, from the codes that withdraw a notice
 * (ADR-0011). `allTopics` holds the blanket withdrawal, code 88.
 *
 * IRIS states the moment in the `ts` attribute as `YYMMDDhhmm`, zero-padded and fixed width,
 * so comparing the strings orders them. A withdrawal without a `ts` cannot be placed in the
 * sequence and is ignored rather than guessed at.
 */
type RevokedAt = ReadonlyMap<Revocation, string>;

const revokedAt = (elements: readonly Element[]): RevokedAt => {
  const latest = new Map<Revocation, string>();
  for (const m of elements) {
    if (m.getAttribute('t') !== 'q') continue;
    const code = m.getAttribute('c');
    const ts = m.getAttribute('ts');
    if (code === null || ts === null) continue;
    const revokes = resolveRevocation(code);
    if (revokes === undefined) continue;
    const known = latest.get(revokes);
    if (known === undefined || ts > known) latest.set(revokes, ts);
  }
  return latest;
};

/**
 * Whether a withdrawal has overtaken this notice.
 *
 * Strictly earlier, not "up to and including": live data shows a stop reporting code 95, then
 * 88, then 95 again with the same `ts` as the 88. The source withdrew and restated in one
 * breath, and the restatement has to survive — so only a notice stamped *before* the
 * withdrawal goes. A notice without a `ts` cannot be ordered against one and stays.
 */
const isRevoked = (m: Element, topic: QualityTopic, revoked: RevokedAt): boolean => {
  const ts = m.getAttribute('ts');
  if (ts === null) return false;
  const forTopic = revoked.get(topic);
  const forAll = revoked.get(ALL_TOPICS);
  return (forTopic !== undefined && ts < forTopic) || (forAll !== undefined && ts < forAll);
};

/** `<s>`-level messages plus the governing movement's own, deduplicated by message id. */
const collectMessages = (ownMessages: readonly Element[], governing: Element | undefined): BoardMessage[] => {
  const byId = new Map<string, Element>();
  for (const m of ownMessages) {
    const id = m.getAttribute('id');
    if (id !== null) byId.set(id, m);
  }
  if (governing !== undefined) {
    for (const m of children(governing, 'm')) {
      const id = m.getAttribute('id');
      if (id !== null) byId.set(id, m);
    }
  }
  const elements = [...byId.values()];
  const revoked = revokedAt(elements);
  const messages: BoardMessage[] = [];
  for (const m of elements) {
    const mapped = mapMessage(m);
    if (mapped === undefined) continue;
    if (mapped.kind === 'qualityNotice' && isRevoked(m, mapped.topic, revoked)) continue;
    messages.push(mapped);
  }
  return messages;
};

const mapTrainRef = (category: string, number: string, line: string | undefined, operator: string | undefined): TrainRef => ({
  category,
  number,
  ...(line === undefined ? {} : { line }),
  ...(operator === undefined ? {} : { operator }),
});

interface FchgStop {
  readonly ar?: Element;
  readonly dp?: Element;
  readonly ownMessages: readonly Element[];
}

const indexChanges = (fchgDoc: Document): Map<string, FchgStop> => {
  const map = new Map<string, FchgStop>();
  for (const s of children(fchgDoc.documentElement, 's')) {
    const id = s.getAttribute('id');
    if (id === null) continue;
    const ar = child(s, 'ar');
    const dp = child(s, 'dp');
    map.set(id, {
      ...(ar === undefined ? {} : { ar }),
      ...(dp === undefined ? {} : { dp }),
      ownMessages: children(s, 'm'),
    });
  }
  return map;
};

const mapDeparture = (
  id: string,
  category: string,
  number: string,
  operator: string | undefined,
  planDp: Element,
  change: FchgStop | undefined,
): DepartureEntry | undefined => {
  const time = resolveTime(planDp, change?.dp);
  const pathNames = resolvePathNames(planDp, change?.dp);
  const destinationName = pathNames.at(-1);
  if (time === undefined || destinationName === undefined) return undefined;

  const status = resolveStatus(change?.dp, time);
  const messages = collectMessages(change?.ownMessages ?? [], change?.dp);
  if (status === 'cancelled') messages.push({ kind: 'cancellation', text: 'Zug fällt aus' });

  return {
    kind: 'departure',
    id,
    train: mapTrainRef(category, number, preferChanged(planDp, change?.dp, 'l'), operator),
    platform: resolvePlatform(planDp, change?.dp),
    time,
    status,
    messages,
    destination: routeStop(destinationName),
    via: pathNames.slice(0, -1).map(routeStop),
  };
};

const mapTerminating = (
  id: string,
  category: string,
  number: string,
  operator: string | undefined,
  planAr: Element,
  change: FchgStop | undefined,
): TerminatingArrivalEntry | undefined => {
  const time = resolveTime(planAr, change?.ar);
  const pathNames = resolvePathNames(planAr, change?.ar);
  const originName = pathNames[0];
  if (time === undefined || originName === undefined) return undefined;

  const status = resolveStatus(change?.ar, time);
  const messages = collectMessages(change?.ownMessages ?? [], change?.ar);
  if (status === 'cancelled') messages.push({ kind: 'cancellation', text: 'Zug fällt aus' });

  return {
    kind: 'terminatingArrival',
    id,
    train: mapTrainRef(category, number, preferChanged(planAr, change?.ar, 'l'), operator),
    platform: resolvePlatform(planAr, change?.ar),
    time,
    status,
    messages,
    origin: routeStop(originName),
  };
};

const mapStop = (planStop: Element, changes: Map<string, FchgStop>): BoardEntry | undefined => {
  const id = planStop.getAttribute('id');
  const tl = child(planStop, 'tl');
  const category = tl?.getAttribute('c');
  const number = tl?.getAttribute('n');
  if (id === null || category === null || category === undefined || number === null || number === undefined) {
    return undefined;
  }
  const operator = tl?.getAttribute('o') ?? undefined;
  const change = changes.get(id);

  // A stop with a departure part is a departure regardless of whether it also arrives
  // (a through train); only an arrival with no departure ends here (ADR-0003).
  const planDp = child(planStop, 'dp');
  if (planDp !== undefined) {
    return mapDeparture(id, category, number, operator, planDp, change);
  }
  const planAr = child(planStop, 'ar');
  if (planAr !== undefined) {
    return mapTerminating(id, category, number, operator, planAr, change);
  }
  return undefined;
};

/** Maps one or more `plan` hour buckets plus one `fchg` document into board entries. */
export const mapBoardEntries = (planDocs: readonly Document[], fchgDoc: Document): BoardEntry[] => {
  const changes = indexChanges(fchgDoc);
  const seen = new Set<string>();
  const entries: BoardEntry[] = [];
  for (const planDoc of planDocs) {
    for (const s of children(planDoc.documentElement, 's')) {
      const id = s.getAttribute('id');
      if (id === null || seen.has(id)) continue;
      seen.add(id);
      const entry = mapStop(s, changes);
      if (entry !== undefined) entries.push(entry);
    }
  }
  return entries;
};

/** Maps a `station` response into the (usually single) matching station's details. */
export const mapStationDetails = (doc: Document): StationDetails[] => {
  const results: StationDetails[] = [];
  for (const station of children(doc.documentElement, 'station')) {
    const evaNumber = station.getAttribute('eva');
    const name = station.getAttribute('name');
    if (evaNumber === null || name === null) continue;
    const ds100 = station.getAttribute('ds100') ?? undefined;
    const platformsRaw = station.getAttribute('p') ?? '';
    results.push({
      evaNumber,
      name,
      ...(ds100 === undefined ? {} : { ds100 }),
      platforms: platformsRaw === '' ? [] : platformsRaw.split('|'),
    });
  }
  return results;
};
