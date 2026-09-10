# ADR-0003 — Terminating trains share the departure board

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-09

## Context and Problem Statement

A platform display shows what is happening at that platform, which is not only departures. A train
that ends at the station still occupies the platform, still has a delay, and still has to be announced
— but it has no destination and no onward stops. The reference display's input form reflects this: its
train field is labelled "Von/Nach" (from/to), not "Nach".

The upstream data distinguishes the cases structurally: a stop record carries an arrival part, a
departure part, or both. A stop with an arrival and no departure is a train ending here; the station it
came from is the first entry of the arrival's path.

So the question is how the domain model represents this: one board of mixed entries, two separate
modes, or departures only.

## Decision Drivers

| ID | Driver | Why it matters |
|---|---|---|
| D01 | Faithfulness to a real platform display | The project's purpose is recreating a real display, and real displays list terminating trains |
| D02 | One board, one ordering | Entries have to sort into a single time-ordered list; anything that needs two parallel lists complicates every design that renders it |
| D03 | Cost of getting it wrong later | Adding a second entry shape after the components are built means touching the model and every component that reads it |
| D04 | Clarity at the component boundary | A component must be able to tell "has a destination" from "ends here" without guessing from empty fields |

## Considered Options

| Option | D01 | D02 | D03 | D04 |
|---|---|---|---|---|
| **O01** — One board entry type with an explicit kind: departure or terminating arrival | Pro | Pro | Pro | Pro |
| **O02** — Departures only | Con | Pro | Con | Pro |
| **O03** — Separate arrivals mode, chosen by configuration | Con | Con | Undec | Pro |
| **O04** — One entry type, terminating trains marked only by a missing destination | Pro | Pro | Undec | Con |

## Decision Outcome

**O01 — one board entry type carrying an explicit kind.** A board entry is either a `departure`, with a
destination and onward stops, or a `terminatingArrival`, with an origin and neither of those. Both
share time, platform, train identification, status and messages. The governing time is the departure
time for departures and the arrival time for terminating trains, so a single time-ordered list is well
defined.

Trains that merely pass through appear **once**, as their departure; the arrival contributes the origin
as extra information rather than a second entry.

The trade-off accepted is a small amount of ceremony: every consumer has to handle two kinds. That is
deliberate — O04 would avoid the ceremony by letting an absent destination mean "ends here", which is
exactly the kind of implicit state that produces an empty destination field on screen when data is
merely missing. Making the distinction explicit means a missing destination stays a data problem and
"ends here" stays a fact.

**Consequences.** Designs must render a terminating entry, at minimum as an "ends here" state — a
design that ignores the kind will silently show a blank destination, which is the failure mode to watch
for. The provider adapter has to read both the arrival and departure parts of a stop and decide the
kind, rather than reading departures only. Filtering by platform applies to both kinds equally.

## Pros and Cons of the Options

### O01 — One entry type with an explicit kind

A discriminated union: the kind field selects which fields are meaningful.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Faithfulness | Pro — matches what platform displays actually show, and matches the reference's "Von/Nach" field |
| D02 | Single ordering | Pro — one list, one governing timestamp per entry |
| D03 | Later cost | Pro — the shape is settled before any component exists |
| D04 | Clarity | Pro — the kind is checked, not inferred; TypeScript can narrow on it |

### O02 — Departures only

Model and render nothing but departures.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Faithfulness | Con — a train ending at the platform would be invisible while standing there |
| D02 | Single ordering | Pro — trivially, there is only one kind |
| D03 | Later cost | Con — retrofitting a second kind means touching the model and every component |
| D04 | Clarity | Pro — nothing to distinguish |

### O03 — Separate arrivals mode

A configuration switch turns the board into an arrivals board.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Faithfulness | Con — real platform displays do not switch modes; they show both |
| D02 | Single ordering | Con — two lists that can never be merged, and a mode that every design must support |
| D03 | Later cost | Undec — it is a valid feature, just not this one; it would sit alongside rather than replace |
| D04 | Clarity | Pro — the mode is explicit |

Still plausible later as an extra display type (an arrivals hall board), which this decision does not
prevent.

### O04 — Terminating trains marked only by a missing destination

One entry type, no kind field; an absent destination implies "ends here".

| ID | Driver | Assessment |
|---|---|---|
| D01 | Faithfulness | Pro — the data is all present |
| D02 | Single ordering | Pro — one list |
| D03 | Later cost | Undec — the shape survives, but the ambiguity spreads into every consumer |
| D04 | Clarity | Con — "no destination" then means both "ends here" and "we failed to resolve it", and the display cannot tell them apart. Silent wrong output instead of a visible gap |
