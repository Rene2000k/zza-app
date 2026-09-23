# ADR-0011 — Quality messages are their own kind and carry a topic

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-23

## Context and Problem Statement

The departure data source, IRIS, attaches messages to a stop as elements of the form
`<m id="r71234852" t="q" c="85" ts="2609100219"/>`. The `t` attribute is the message type and `c` a
numeric code; there is no text. Of the types seen in live data (`c`, `d`, `e`, `f`, `h`, `p`, `q`,
`r`, `s`), only two were confirmed early on and are mapped today: `d` — a delay cause — and `h` — a
HIM notice, whose `cat` attribute carries the only text the source supplies ("Störung",
"Information", "Bauarbeiten"). Everything else is discarded, because guessing a meaning was worse
than contributing nothing.

Type `q` turns out to be the source of a whole class of information the real display shows in its
scrolling line: a missing coach, a changed coach order, no bicycle carriage, no catering, a missing
universal toilet. A captured `fchg` response for station 8000760 (2026-09-10, 136 stops) contains
72 `q` messages — code 85 ("Ein Wagen fehlt") 58 times and code 82 ("Mehrere Wagen fehlen") 14
times — all attached to an `ar` or `dp` element, none at stop level. In the same response every
`d` code is below 70 (7, 14, 36, 40, 43, 44, 47, 48) and every `q` code is at or above 70, which
suggested that codes 70–99 are quality codes and the codes below are delay causes. A live check on
2026-09-23 confirmed the first half and broke the second: Frankfurt Hbf and München Hbf carried `q`
codes 83 to 97 only, but München also carried `t="d" c="99"` six times. The ranges are a guide to
which codes to look up, not a rule the source obeys.

Two further facts shape the decision:

- The project's own code table currently mixes both ranges in one map named `delayCauseCodes`, so
  the text for code 85 is already present but filed as a delay cause.
- A display must not show all of these. A platform display shows a missing coach; whether the
  on-board WLAN works is not its business. Which ones are shown differs between display
  generations, and per ADR-0009 that choice belongs to the design, not to the provider.

The question this record settles: how does a quality message reach the domain model, so that a
design can pick the ones it shows without learning IRIS code numbers, and without the provider
learning what any display prints?

## Decision Drivers

| ID  | Driver                                         | Why it matters                                                                                              |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| D01 | No display knowledge in the provider           | The layer rule is one-directional; a provider that knows what a display shows makes every design its client |
| D02 | A design selects without knowing source codes  | A design must not carry a list of IRIS numbers; designs are swapped, the source is not                      |
| D03 | Designs differ in what they show               | Several generations coexist and each shows a different subset of the same messages                          |
| D04 | An unknown or new code stays harmless          | The source adds codes without notice, and a bare number must never reach the screen                         |
| D05 | Delay causes stay distinguishable from quality | They are already mapped differently and are worded differently by the display                               |
| D06 | Cost of adding a code or a design              | Both happen repeatedly; neither may require touching the other layer                                        |

## Considered Options

| Option                                                       | D01 | D02   | D03 | D04 | D05   | D06   |
| ------------------------------------------------------------ | --- | ----- | --- | --- | ----- | ----- |
| **O01** — Flag "shown in the running line" in the code table | Con | Pro   | Con | Pro | Undec | Con   |
| **O02** — One quality kind, no topic                         | Pro | Con   | Con | Pro | Pro   | Undec |
| **O03** — Quality kind with a topic, design selects topics   | Pro | Pro   | Pro | Pro | Pro   | Pro   |
| **O04** — Map quality codes onto the existing kinds          | Pro | Undec | Con | Pro | Con   | Undec |

## Decision Outcome

Chosen: **O03**.

A quality message is its own `MessageKind`, `qualityNotice`, and carries a second field, `topic` — a
closed union of the subjects the codes fall into: `coachOrder`, `missingCoaches`, `bicycle`,
`catering`, `accessibility`, `onboardServices`, `reservation`, `occupancy`, `busReplacement`,
`other`. The provider owns the mapping from code to topic; it states a subject, never a verdict
about visibility. A design names the topics it shows and ignores the rest, so it never sees a code
number.

The code table is split accordingly: `delayCauseCodes` and `qualityCodes` are two tables instead of
one map called `delayCauseCodes` that holds both. A code in neither table resolves to nothing, as
before — never to the bare number.

Each table is keyed by the message **type** that carries the code, not by a range. The ranges — delay
causes below 70, quality codes from 70 — are how the tables were authored, and the source does not
hold to them: a live check on 2026-09-23 (see below) found `t="d" c="99"`, a code from the quality
range arriving as a delay cause. Code 99 therefore sits in both tables, and neither may be derived
from the other by a range check.

**Accepted trade-off.** The topic list is this project's invention, not something the source
publishes. It will be wrong at the edges: code 83 ("Heute ohne fahrzeuggebundene Einstiegshilfe")
sits under accessibility together with the missing universal toilet, and a display that wants one
but not the other cannot say so without splitting the topic first. Assigning a code to the wrong
topic is a one-line correction in the provider, which is why this is acceptable; the alternative —
a topic per code — is the code number again, wearing a name.

**Wording stays with the source text for now.** ADR-0009 gives the wording to the design, and the
model is shaped so a design _can_ word a topic itself. The first design to use this does not: it
prints the resolved IRIS text ("Fahrradmitnahme nicht möglich") unchanged, because those texts are
the wording the real displays use. The topic is therefore used for _selection_ only. A later design
that wants "Keine Fahrradmitnahme" writes that against the topic without any provider change, which
is the property this model exists for.

**Cancelling codes withdraw the notices they overtake.** Three codes revoke earlier ones: 84 ("Zug
verkehrt richtig gereiht") withdraws coach-order notices, 89 ("Reservierungen sind wieder vorhanden")
reservation notices, and 88 ("Keine Qualitätsmängel") all of them. None of the three ever becomes a
message itself; what each does is silence the notices of its topic that are stamped **strictly
earlier** in the `ts` attribute every message carries.

**Consequences.** A design gains a message class it can filter by subject, and adding a code means
one row in the provider's table. What becomes harder: the topic union is part of the domain model,
so widening it touches every design that switches over topics exhaustively.

The failure mode to watch is now the opposite one: a notice that disappears when it should have
stayed. Withdrawal rests on the reading that 84, 88 and 89 revoke a *topic* — that is this project's
interpretation of codes the source ships without documentation, and 84 and 89 have not been seen in
live data at all, so only 88 is observed behaviour. If a display ever goes quiet about a fault that
is plainly still there, this is the first place to look, and the way back is to narrow what each code
withdraws, or to stop applying it, in the provider alone.

Withdrawal is scoped to one stop: it works over the messages collected for that entry, which is what
IRIS's own sequence covers. A notice withdrawn at one station says nothing about another.

The second thing to watch is how the two tables are kept. They are per message type, so a code the
source starts sending under both types needs a row in each; code 99 already does. A code missing
from the table its type uses resolves to nothing and the message silently disappears — the safe
direction, but one that should be noticed rather than endured, and one a range check would
reintroduce.

## Pros and Cons of the Options

### O01 — Flag "shown in the running line" in the code table

Each code in the provider's table gets a boolean saying whether a display shows it; the design
prints the messages so marked.

| ID  | Driver                                         | Assessment                                                                                        |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D01 | No display knowledge in the provider           | Con — the flag _is_ display knowledge, written into the layer that must not have it               |
| D02 | A design selects without knowing source codes  | Pro — the design sees a ready-made selection and no numbers                                       |
| D03 | Designs differ in what they show               | Con — one flag serves one display; a second generation needs a second flag, then a third          |
| D04 | An unknown or new code stays harmless          | Pro — an unknown code is absent from the table and resolves to nothing                            |
| D05 | Delay causes stay distinguishable from quality | Undec — the flag says nothing either way; the ranges would still have to be separated             |
| D06 | Cost of adding a code or a design              | Con — a new design edits the provider's table, which is exactly the dependency direction to avoid |

This is the option the shape of the existing table invites, which is why it is recorded rather than
left out.

### O02 — One quality kind, no topic

A `qualityNotice` kind with code and text, and nothing to distinguish a missing coach from a
missing WLAN.

| ID  | Driver                                         | Assessment                                                                              |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| D01 | No display knowledge in the provider           | Pro — the provider classifies by source type only                                       |
| D02 | A design selects without knowing source codes  | Con — the only way to select a subset is to switch over code numbers in the design      |
| D03 | Designs differ in what they show               | Con — either every design shows all quality messages, or each grows its own code list   |
| D04 | An unknown or new code stays harmless          | Pro — unchanged from today                                                              |
| D05 | Delay causes stay distinguishable from quality | Pro — that is precisely what the new kind establishes                                   |
| D06 | Cost of adding a code or a design              | Undec — a code is cheap; a design is expensive, because selection has to be built again |

Cheapest to implement and the one to fall back to if the topic list proves unworkable — the kind
can stay and the topic be dropped without touching the design boundary.

### O03 — Quality kind with a topic, design selects topics

A `qualityNotice` kind plus a topic union; the provider maps code → topic, the design names the
topics it shows.

| ID  | Driver                                         | Assessment                                                            |
| --- | ---------------------------------------------- | --------------------------------------------------------------------- |
| D01 | No display knowledge in the provider           | Pro — a topic is a statement about the subject, not about any display |
| D02 | A design selects without knowing source codes  | Pro — the design names topics; code numbers stay inside the provider  |
| D03 | Designs differ in what they show               | Pro — each design carries its own topic set, and they do not interact |
| D04 | An unknown or new code stays harmless          | Pro — no topic, no text, no message                                   |
| D05 | Delay causes stay distinguishable from quality | Pro — separate kind and separate code table                           |
| D06 | Cost of adding a code or a design              | Pro — a code is one table row; a design is one topic set              |

The cost is the judgement call in the mapping itself, discussed as the accepted trade-off above.

### O04 — Map quality codes onto the existing kinds

Reuse `info`, `constraint` and `disruption`: a missing coach becomes a `constraint`, no WLAN becomes
`info`.

| ID  | Driver                                         | Assessment                                                                                         |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| D01 | No display knowledge in the provider           | Pro — no visibility decision is written down                                                       |
| D02 | A design selects without knowing source codes  | Undec — selection by kind works, but the kinds do not separate what a display wants to separate    |
| D03 | Designs differ in what they show               | Con — "constraint" lumps a missing coach with a missing WLAN; no design can take one and not other |
| D04 | An unknown or new code stays harmless          | Pro — unchanged                                                                                    |
| D05 | Delay causes stay distinguishable from quality | Con — quality messages dissolve into kinds already used for HIM notices and become untraceable     |
| D06 | Cost of adding a code or a design              | Undec — cheap now, and the cost appears later as a forced re-classification                        |

Rejected mainly on D05: the existing three kinds exist to classify HIM categories, which are a
different axis entirely, and overloading them makes both harder to reason about.
