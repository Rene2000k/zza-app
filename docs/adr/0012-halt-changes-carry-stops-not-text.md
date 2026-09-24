# ADR-0012 — Halt changes are derived from the path comparison and carried as stops, not text

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-23

## Context and Problem Statement

A departure in the IRIS timetable feed carries two versions of its onward route: the planned path
`ppth` on the `plan` document, and the changed path `cpth` on the `fchg` document. Both are
pipe-separated lists of station **names** — never EVA numbers — running from the stop after this
station to the destination.

The adapter currently takes `cpth` when it is non-empty and `ppth` otherwise, and never compares
them. The consequence is not a wrong display but a silent one: the via line already lists the stops
actually served and the destination field already names the real terminus, so the board is factually
right, while the statement _that something changed_ is lost. A traveller who knows the timetable sees
a board that disagrees with it and is told nothing.

Paired `plan`/`fchg` captures for Frankfurt Hbf (197 stops) and Hannover Hbf (145 stops) on
2026-09-23 show four shapes of difference on the departure side:

- **stops removed, destination unchanged** — RE 4534 and RB 15534 without Offenbach(Main)Hbf;
  RE 4430 without Wunstorf and Neustadt am Rübenberge;
- **a trailing run removed, destination changed** — SBH 34230/34232/34234, whose last four stops
  disappear and whose destination moves from Nienburg(Weser) to Neustadt am Rübenberge;
- **stops inserted** — ICE 574 gaining Hamburg-Harburg before Hamburg Hbf;
- **both at once** — ICE 544 losing Gelsenkirchen Hbf, Duisburg Hbf and Düsseldorf Hbf and gaining
  Solingen Hbf on its way to the unchanged destination Köln Hbf; IC 2034 losing nine stops and
  gaining Osnabrück Hbf on its way to the unchanged destination Norddeich.

The last shape is a diversion in the real world. On a platform display it is not a concept of its
own: the display says which stops are dropped and which are added, exactly as it would for the first
and third shape occurring together.

Two constraints bound the answer. ADR-0009 gives the wording to the design, so whatever reaches the
model must not already be a sentence. ADR-0005 fixes the via line to the next three stops in travel
order, and roughly half of the observed differences lie beyond that window — so the via line cannot
be the place where a change is noticed, and the running line has to carry it.

The question this record settles: how does "this train skips a stop / ends early / stops somewhere
extra" get from the two paths into the model, without the provider deciding how it is worded?

## Decision Drivers

| ID  | Driver                               | Why it matters                                                                                      |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| D01 | Provider does not fix the wording    | ADR-0009 reserves wording for the design; a provider that ships a sentence takes that away          |
| D02 | The three cases stay distinguishable | A real display words each one differently, so they must not collapse into one "route changed" flag  |
| D03 | No concept the source cannot support | IRIS signals no diversion; inventing one means showing a classification the source never stated     |
| D04 | The derivation is written once       | Several designs coexist; a comparison rule re-implemented per design will drift between them        |
| D05 | Via line and destination stay as-is  | Both are already correct, and ADR-0005 governs the via line — this decision must not disturb either |
| D06 | Model stays small                    | Every field on an entry is a commitment each further provider and design has to reckon with         |

## Considered Options

| Option                                                          | D01 | D02   | D03 | D04 | D05 | D06   |
| --------------------------------------------------------------- | --- | ----- | --- | --- | --- | ----- |
| **O01** — Halt changes as `BoardMessage`s with finished text    | Con | Undec | Pro | Pro | Pro | Pro   |
| **O02** — Structured field on the entry: case plus stops        | Pro | Pro   | Pro | Pro | Pro | Con   |
| **O03** — A fourth case for diversion, or the `diverted` status | Pro | Pro   | Con | Pro | Pro | Undec |
| **O04** — Carry both paths, let each design compare them        | Pro | Undec | Pro | Con | Pro | Con   |

## Decision Outcome

Chosen: **O02**.

A departure carries `routeChanges`, a list of structured findings:

```ts
export type RouteChangeKind = 'skippedStops' | 'endsEarly' | 'additionalStops';

export interface RouteChange {
  readonly kind: RouteChangeKind;
  /** The stops this change is about, in travel order. */
  readonly stops: readonly RouteStop[];
}
```

`stops` means the same thing in all three cases — the stops the change is about, in travel order:
the ones no longer served, the trailing run no longer reached, the ones newly served. No text, no
sentence, no station formatted into a string. The design turns a finding into "Heute ohne Halt in …",
"Heute nur bis …" or "Heute mit zusätzlichem Halt in …". For `endsEarly` the new terminus is already
on the entry as `destination`, and the last element of `stops` is the terminus the timetable
promised, so a design can word either half without asking the provider for more.

The derivation, in the provider, from a departure's `ppth` and `cpth`:

1. A cancelled stop (`cs="c"`) yields no route change at all — the cancellation is the
   statement, and a train that does not run cannot skip a stop.
2. Names in `cpth` absent from `ppth` → `additionalStops`, except the stop the train now
   terminates at when it ends early: "ends there" already says it calls there.
3. Names in `ppth` absent from `cpth` are split: the maximal **trailing run** of `ppth` that is
   entirely absent → `endsEarly`; everything left over → `skippedStops`.

Against the captures above this yields: RE 4534, RB 15534 and RE 4430 → `skippedStops` only;
SBH 34230/34232/34234 → `endsEarly` only, with no spurious `skippedStops`; ICE 574 →
`additionalStops` only; ICE 544 and IC 2034 → `skippedStops` **and** `additionalStops`.

**A diversion is not a case.** It is the combination that falls out of the rule, and it is what a
platform display says anyway: which stops are gone, which are new. The existing `EntryStatus` value
`diverted` stays unused by this adapter, as it has been — a drop plus an add is not evidence that
IRIS meant "diversion", and ADR-0002's reading still holds that the source signals no such thing.

**Accepted trade-off.** The model grows a concept that only one provider populates today: a type and
a field that every further provider and design has to reckon with, for a list that is empty on the
overwhelming majority of entries.

**Cancellation outranks the comparison, and the check is on `cs`, not on the path.** The obvious
reading — "an empty `cpth` means cancelled" — is not enough. In the Hannover capture 27 cancelled
departures carry an empty `cpth`, 6 carry the planned path unchanged, and **11 carry a non-empty
path that differs from the plan**: RE 4424, RE 4422, RE 4434, RE 4420 and IC 2442 among them. Deriving
from the path alone would announce "Heute ohne Halt in …" for trains that are not running at all. The
rule therefore keys on `cs="c"`, which IRIS states plainly — IC 2446 on 2026-09-23 shows the full
shape: `cs="c"` on both `ar` and `dp`, an emptied `cpth`, and `clt="2609220203"` recording that the
cancellation was entered the previous day.

**Consequences.** A design gains the three cases as data and words them itself; adding a second
design costs one formatting function and no data-layer change. The via list and the destination stay
exactly as they are — this decision adds a statement about the route, it does not alter the route.

What has to be watched is a long list. IC 2034 drops nine stops, so "Heute ohne Halt in …" names
nine stations. That is deliberate — real displays do read them all out — but it makes the running
line long, and a design that cannot fit it shortens it itself. The model always carries the full list.

The comparison is sound because the two feeds play different roles: `plan` is the timetable, settled
days ahead and not revised, and every deviation is published in `fchg`. A difference between them is
therefore a real change rather than one feed catching up with the other.

Nothing is lost when a stop has no changed path: board entries are built by walking the `plan`
documents and looking up changes by stop id, so an entry always has a `ppth`, and a missing or
unchanged `cpth` simply means nothing changed.

## Pros and Cons of the Options

### O01 — Halt changes as `BoardMessage`s with finished text

The provider builds "Heute ohne Halt in Offenbach(Main)Hbf" and appends it to `messages`, reusing
the carrier the quality notices already use.

| ID  | Driver                               | Assessment                                                                         |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| D01 | Provider does not fix the wording    | Con — the sentence _is_ the wording, decided in the layer ADR-0009 keeps it out of |
| D02 | The three cases stay distinguishable | Undec — distinguishable only by parsing the text back, which is not a distinction  |
| D03 | No concept the source cannot support | Pro — nothing is invented beyond the comparison itself                             |
| D04 | The derivation is written once       | Pro — the rule lives in the provider                                               |
| D05 | Via line and destination stay as-is  | Pro — untouched                                                                    |
| D06 | Model stays small                    | Pro — no new field, no new type                                                    |

Cheapest by some way, and the reason it is written down: it is what the quality notices do, so it
looks like the consistent choice. The difference is that a quality code _comes with_ its text from a
lookup table, while a halt change would have its text **composed** in the provider — station names
formatted into a German sentence. That is a different act, and it is the one ADR-0009 forbids.

### O02 — Structured field on the entry: case plus stops

`routeChanges: readonly RouteChange[]` on `DepartureEntry`, each carrying a kind and the stops it
concerns.

| ID  | Driver                               | Assessment                                                               |
| --- | ------------------------------------ | ------------------------------------------------------------------------ |
| D01 | Provider does not fix the wording    | Pro — the provider states stops and a case, never a sentence             |
| D02 | The three cases stay distinguishable | Pro — the case is the discriminant, and the stops come with it           |
| D03 | No concept the source cannot support | Pro — all three cases are read off the two paths, nothing beyond         |
| D04 | The derivation is written once       | Pro — one rule in the provider, shared by every design                   |
| D05 | Via line and destination stay as-is  | Pro — additive; neither is recomputed                                    |
| D06 | Model stays small                    | Con — a new type and a new field on the entry, populated by one provider |

The D06 cost is the real one and is accepted in the outcome above.

### O03 — A fourth case for diversion, or the `diverted` status

Treat "stops dropped **and** added" as its own case, or set the existing `EntryStatus` value
`diverted`, which the model already defines and no adapter sets.

| ID  | Driver                               | Assessment                                                                                     |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| D01 | Provider does not fix the wording    | Pro — still structured data                                                                    |
| D02 | The three cases stay distinguishable | Pro — and adds a fourth                                                                        |
| D03 | No concept the source cannot support | Con — IRIS never says "diversion"; a drop beside an add is the evidence _and_ the entire basis |
| D04 | The derivation is written once       | Pro — same place                                                                               |
| D05 | Via line and destination stay as-is  | Pro — untouched                                                                                |
| D06 | Model stays small                    | Undec — reuses `diverted`, but adds a meaning it did not have                                  |

Rejected on D03, and on what a display would do with it: a diversion still has to be announced as
the stops lost and gained, so the fourth case buys a label nobody prints. It would also quietly
redefine `diverted`, which ADR-0002 left unset precisely because IRIS gives no reliable signal for it.

### O04 — Carry both paths, let each design compare them

The model carries the planned path next to the changed one; every design derives what it needs.

| ID  | Driver                               | Assessment                                                                                    |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| D01 | Provider does not fix the wording    | Pro — the provider decides nothing at all                                                     |
| D02 | The three cases stay distinguishable | Undec — derivable, but only once each design has written the rule                             |
| D03 | No concept the source cannot support | Pro — raw paths, no interpretation                                                            |
| D04 | The derivation is written once       | Con — the rule moves into the designs and drifts between them; exactly what ADR-0009 warns of |
| D05 | Via line and destination stay as-is  | Pro — untouched                                                                               |
| D06 | Model stays small                    | Con — a second full path on every departure, for a difference that is usually empty           |

The honest version of "let the design decide", and worth recording because the boundary is genuinely
arguable. It fails on D04: the trailing-run split is a rule, not a rendering choice, and a rule
belongs where it is written once.
