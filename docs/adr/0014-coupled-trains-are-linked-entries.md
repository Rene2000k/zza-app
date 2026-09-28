# ADR-0014 — Coupled trains stay separate entries, linked from the source's `wings`

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-25

## Context and Problem Statement

Some trains leave a station as one set of coaches under two train numbers and are split somewhere
ahead: HLB 15012 to Kassel and HLB 15112 to Siegen leave Frankfurt(Main)Hbf together and part in
Gießen. A real V3 display shows both parts at once — the first in the upper module row, the second in
the lower one, each with its own time, number, via stops and destination — and names the split in the
running line ("Zug wird in Hannover Hbf geteilt", "Zugteilung in Basdorf"). The board so far treats
the two numbers as unrelated trains: the first becomes the main train, the second a following train at
the same minute, and the split is never mentioned.

IRIS states the coupling. Its `plan` and `fchg` documents carry an attribute `wings` on the `ar`
and `dp` elements. A capture of eight stations over four plan hours on 2026-09-25 (Frankfurt(Main)Hbf,
Hannover Hbf, München Hbf, Hamburg Hbf, Dresden Hbf, Köln Hbf, Hagen Hbf, Basdorf) found 26 stops
with `wings`, at five of the stations:

- The value names the partner by its **trip** — the stop id without its trailing stop index:
  `wings="-8906112445839706377-2609250926"` on ICE 857 points at the stop
  `-8906112445839706377-2609250926-9`, ICE 847. Several partners would be pipe-separated.
- In all 26 cases the partner was in the same plan, at the same time and platform, and **carried no
  `wings` of its own**. The link is one-sided.
- `wings` on `dp` only: a train leaving coupled and split ahead (HLB 15012/15112, split in Gießen;
  RE 11266/11166 at Hamburg Hbf, split in Neumünster; TL 76523/76551 at Dresden Hbf, split in
  Bischofswerda). `wings` on `ar` only: two parts arriving coupled and ending here (RE 11169 from
  Flensburg and RE 11269 from Kiel at Hamburg Hbf). On both: two parts passing through coupled — ICE
  857 and 847 at Hannover Hbf, joined in Hamm, both to Berlin Südkreuz.
- `fchg` repeats the attribute with the same value where it re-sends a movement.

The split station is not stated anywhere. It can be read off the two routes: the last stop both parts
call at.

The question this record settles: how does the coupling get from `wings` into the model, and which
layer decides what a display makes of it?

## Decision Drivers

| ID  | Driver                                | Why it matters                                                                                        |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| D01 | Built on what the source states       | A coupling guessed from coincidences shows two unrelated trains as one                                |
| D02 | Each part keeps its own state         | Parts differ: one can be cancelled or late while the other runs; each has its own number and messages |
| D03 | Small change for the layers above     | Every design and every further provider reads `BoardEntry`; reshaping it touches all of them          |
| D04 | The display rule is not the provider's | Whether and where a second part is shown is a design question (ADR-0009), not a property of the data  |

## Considered Options

| Option                                                            | D01 | D02 | D03   | D04 |
| ----------------------------------------------------------------- | --- | --- | ----- | --- |
| **O01** — Separate entries, linked both ways by `coupledWith`     | Pro | Pro | Pro   | Pro |
| **O02** — One entry per coupled train, carrying its `parts`       | Pro | Con | Con   | Con |
| **O03** — Pair in the view model by same time and platform        | Con | Pro | Pro   | Pro |

## Decision Outcome

Chosen: **O01**.

Every part stays a `BoardEntry` of its own. The entry gains an optional
`coupledWith: readonly string[]`, the ids of the entries it runs coupled with from here. The IRIS
adapter reads `wings` from the movement that governs the entry — the departure, or the arrival of a
train ending here — so a train that arrives coupled and leaves alone is split here and is not coupled
on this board. It resolves each trip to the entry whose stop id starts with it, and writes the link
into **both** entries, since the source names it on one side only. A partner outside the mapped
entries is dropped.

What a display makes of the link is decided above the provider:

- `separatesAhead` (domain): two parts separate when both depart, for different destinations.
  `splitStop` (domain): the last stop on the first part's route that the second calls at as well.
- Parts that do **not** separate — the same destination, or ending here together — are one train as
  far as the platform is concerned. The view model lists only the first of them; the other number
  is not shown. This is the maintainer's choice over showing both in two rows.
- The main train's partner that separates ahead becomes `secondPart` on the view model and leaves the
  following trains. Partners among the following trains stay separate rows.
- V3 5X2 shows `secondPart` in the lower module row with the upper row's layout, in place of the
  following trains, and runs "Zug wird in Gießen geteilt" above both parts — unless one of them is
  cancelled.

**Accepted trade-off.** Which part is on top is whatever comes first in the provider's order at the
same minute, not the front or rear of the train — IRIS says nothing about coach order, and no
coach-sequence source is available. A three-part train shows only its first partner.

**Consequences.** Delays, cancellations and messages of each part keep working unchanged, because
each part is still an ordinary entry. A further provider without a coupling signal simply leaves
`coupledWith` absent and every board looks as before. If IRIS ever starts naming partners on both
sides, the linking becomes redundant but not wrong. If `wings` stops appearing, coupled trains fall
back silently to two following rows at the same minute — the state before this decision; a live
check for `wings` at Hannover Hbf or Hamburg Hbf shows whether the attribute is still there. O03 is
the fallback if the attribute disappears for good.

## Pros and Cons of the Options

### O01 — Separate entries, linked both ways by `coupledWith`

The provider leaves the entries as they are and adds the ids of the partners to each of them.

| ID  | Driver                                | Assessment                                                                   |
| --- | ------------------------------------- | ---------------------------------------------------------------------------- |
| D01 | Built on what the source states       | Pro — read from `wings`, nothing inferred beyond resolving the trip id        |
| D02 | Each part keeps its own state         | Pro — each part is a complete entry                                          |
| D03 | Small change for the layers above     | Pro — one optional field; consumers that ignore it see the old board          |
| D04 | The display rule is not the provider's | Pro — the provider links; hiding, pairing and wording happen above it        |

### O02 — One entry per coupled train, carrying its `parts`

The provider merges the partners into one entry with a list of parts, each with number, destination
and via stops.

| ID  | Driver                                | Assessment                                                                                      |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| D01 | Built on what the source states       | Pro — same signal                                                                               |
| D02 | Each part keeps its own state         | Con — time, status and messages would have to move into the parts, or be merged and lose detail |
| D03 | Small change for the layers above     | Con — every consumer of `BoardEntry` has to learn the new shape                                 |
| D04 | The display rule is not the provider's | Con — merging is already the decision that the parts are shown as one                           |

### O03 — Pair in the view model by same time and platform

No provider change; the view model treats two entries at the same minute and platform as coupled.

| ID  | Driver                                | Assessment                                                                                            |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| D01 | Built on what the source states       | Con — two independent trains on one long platform, sections A–C and D–G, look exactly like a coupling |
| D02 | Each part keeps its own state         | Pro — entries stay as they are                                                                        |
| D03 | Small change for the layers above     | Pro — no model change at all                                                                          |
| D04 | The display rule is not the provider's | Pro — it all happens above the provider                                                               |

Rejected on D01. It only becomes worth doing if the source stops stating the coupling.
