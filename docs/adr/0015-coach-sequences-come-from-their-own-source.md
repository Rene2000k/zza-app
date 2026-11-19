# ADR-0015 — Wagenreihungen come from their own source, not from the departure provider

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-11-17

## Context and Problem Statement

The Wagenstandsanzeiger needs the Wagenreihung of a departing train: its coaches in order, with
number, class and features. The departure source (IRIS) does not deliver one — its `wzr` path
answers "Request Rejected", `wingdef` answers 404 — and no free real-time source was found on
2026-09-08 (the bahn.de vehicle-sequence endpoint answers 403 `OPS_BLOCKED`, the classic
`ist-wr.noncd.db.de` host no longer resolves, `regio-guide.de` answers 200 with an empty body; the DB
API Marketplace has no free tier).

The interface was shaped for a source that would deliver departures and Wagenreihungen together:
`DepartureProvider` carries an optional `getFormation?` method and a `formations` capability flag,
and `BoardEntry` has an optional `formation`. IRIS reports `formations: false`; nothing implements
the method.

The candidate that has turned up is a different kind of source. fernbahn.de keeps a hand-curated
directory of planmäßige Wagenreihungen per timetable year (checked 2026-11-17 on ICE 600): coach
numbers with their UIC type code (`1 Bpmdzf · 2 Bpmz … 10 ARmz · 11 Apmz … 14 Apmzf`), features per
coach number, several variants per train number by validity period and starting station. It knows
nothing about departures, and it is not the only conceivable future source — a real-time one may
appear, or the departure source may have to be replaced at short notice, which is why the provider
layer exists in the first place.

Two requirements stand regardless of the source: the departure display must never depend on the
Wagenreihung — without one, the Wagenstandsanzeiger shows its defined idle state, which is the normal
case, not an error — and no vendor type may leak above the provider layer.

The question this record settles: where does a Wagenreihung source plug in?

## Decision Drivers

| ID  | Driver                               | Why it matters                                                                                         |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| D01 | Sources replaceable independently    | The departure source may have to be swapped at short notice; the Wagenreihung source is a separate bet |
| D02 | Board never waits for a Wagenreihung | A slow or missing Wagenreihung must not delay or break the departures                                  |
| D03 | No provider knows another provider   | A provider that calls a second vendor mixes two failure modes and two vendor models in one place       |
| D04 | Small change for the layers above    | Designs read `BoardEntry.formation` already; anything that changes that shape touches every design     |

## Considered Options

| Option                                                                       | D01 | D02   | D03 | D04 |
| ---------------------------------------------------------------------------- | --- | ----- | --- | --- |
| **O01** — Own `FormationProvider` port, joined onto the board by a hook      | Pro | Pro   | Pro | Pro |
| **O02** — Composite provider wrapping a departure and a Wagenreihung source  | Con | Undec | Pro | Pro |
| **O03** — Keep `getFormation?` on `DepartureProvider`, each provider adds it | Con | Undec | Con | Pro |

## Decision Outcome

Chosen: **O01**. A Wagenreihung source gets its own interface in the provider layer, configured
independently of the departure provider. A hook in the view-model layer looks up the Wagenreihung for
each board entry through it, as a separate query, and fills `BoardEntry.formation` once it is known;
until then, and whenever the source has none, the entry has no Wagenreihung. `getFormation?` and the
`formations` capability are removed from `DepartureProvider`, since no departure provider implements
them and two places for the same thing invite drift.

Accepted trade-off: the join between a departure and a Wagenreihung — train number, date, and the
route where a number has several variants — moves out of the provider into the hook's call to the
source, so the source's request type has to carry enough of the departure to make that match. That is
a wider request than today's `FormationRequest`, and it is the price of keeping the two sources
apart.

**Consequences.** Any combination of departure source and Wagenreihung source works without a
combined provider. A board renders as soon as its departures are in; Wagenreihungen arrive later or
never. Watch the number of lookups: the hook asks again for every visible entry with each poll,
since a tagesaktuelle Wagenreihung can change while the train is on the board. How long an answer
holds is the provider's to know — one with only planmäßige Wagenreihungen, which change with the
timetable, caches its answers itself rather than passing every lookup on to its source. If this
stops working — say a future source delivers departures and Wagenreihungen in one response and a
second request would waste it — that source can implement both interfaces, without changing this
split.

## Pros and Cons of the Options

### O01 — Own `FormationProvider` port, joined onto the board by a hook

A second, independent port next to `DepartureProvider`, selected in the configuration on its own. The
view model asks it per entry and merges the answer into the entry.

| ID  | Driver                               | Assessment                                                                   |
| --- | ------------------------------------ | ---------------------------------------------------------------------------- |
| D01 | Sources replaceable independently    | Pro — each source is swapped in the configuration without touching the other |
| D02 | Board never waits for a Wagenreihung | Pro — a separate query; the board's own query does not include it            |
| D03 | No provider knows another provider   | Pro — the join happens above both, in the view model                         |
| D04 | Small change for the layers above    | Pro — `BoardEntry.formation` keeps its shape; designs do not change          |

### O02 — Composite provider wrapping a departure and a Wagenreihung source

A `DepartureProvider` that delegates departures to one source and fills `getFormation?` or the
entries from another.

| ID  | Driver                               | Assessment                                                                                                                 |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| D01 | Sources replaceable independently    | Con — every pairing of departure and Wagenreihung source needs its own composite, or a generic one that is O01 in disguise |
| D02 | Board never waits for a Wagenreihung | Undec — depends on whether the composite fills entries before returning the board or exposes the method separately         |
| D03 | No provider knows another provider   | Pro — the inner sources stay apart; the composite knows both                                                               |
| D04 | Small change for the layers above    | Pro — nothing above the provider changes                                                                                   |

### O03 — Keep `getFormation?` on `DepartureProvider`, each provider adds it

The current interface: a departure provider that wants Wagenreihungen implements the method itself,
calling fernbahn.de from inside the IRIS provider, for instance.

| ID  | Driver                               | Assessment                                                                                        |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| D01 | Sources replaceable independently    | Con — replacing IRIS means re-implementing the Wagenreihung lookup in its successor               |
| D02 | Board never waits for a Wagenreihung | Undec — fine if called separately, as the optional method allows; breaks if a provider inlines it |
| D03 | No provider knows another provider   | Con — the IRIS provider would carry a second vendor's parsing and failures                        |
| D04 | Small change for the layers above    | Pro — the interface already exists                                                                |
