# ADR-0006 — A platform-filtered board keeps entries that changed away from that platform

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-10

## Context and Problem Statement

A display can be configured to one station and, optionally, one platform. When a platform is given,
the board only lists trains relevant to that platform, not the whole station.

Every board entry carries both a planned and an actual platform, plus a flag for whether they
differ (a train "changed" platform). A first implementation filtered the board by matching only the
actual platform against the configured one: the moment a train's actual platform stopped matching,
it dropped off the board on the very next refresh.

That is exactly backwards for the situation travellers most need help with. A platform display's
job is to tell someone standing at a platform that their train no longer leaves from there — the
instant it changes away is the instant the display matters most. Dropping the entry silently, on
the next poll, is indistinguishable from a data failure: nothing on screen says "this train moved",
it simply stops being mentioned.

Real platform displays for the affected gleis keep announcing such a train, marked with its new
platform, for a while after the change — before eventually replacing it with the train that
actually departs from there next.

## Decision Drivers

| ID | Driver | Why it matters |
|---|---|---|
| D01 | A train that changed away from this platform must still be announced here, not silently dropped | Matches what a real platform display does, and prevents "vanished" from looking like broken data |
| D02 | The filter still has to narrow the board over time | A platform's board should not accumulate every train that was ever associated with it |
| D03 | Checkable from data the domain model already has | No new field or timer should be needed just to decide filter membership |

## Considered Options

| Option | D01 | D02 | D03 |
|---|---|---|---|
| **O01** — Match the actual platform only (prior behavior) | Con | Pro | Pro |
| **O02** — Once matched, keep an entry on the board indefinitely | Pro | Con | Pro |
| **O03** — Match planned **or** actual platform | Pro | Pro | Pro |

## Decision Outcome

**O03 — an entry belongs to a platform's board when either its planned or its actual platform
matches the requested one.** This needs no new data: `planned`, `actual` and `changed` already
exist on every entry (from the domain model settled before this decision). A train that changed
away from the configured platform keeps appearing there, carrying `changed: true` and its new
actual platform; a train that changed **to** the configured platform appears there too, as before.

The trade-off accepted is scope: this decision only guarantees the entry survives the filter, not
how it is positioned or rendered once it does. A real display additionally moves such a train into
a distinct "next trains" slot and promotes the train that genuinely departs next into the headline
position — that repositioning is a rendering/rotation concern that depends on how a specific design
lays out its slots, not on what data is available, so it is deliberately out of scope here and
tracked as a separate, later piece of work.

**Consequences.**

- Every provider adapter, including any fixture-backed one used for development, must apply the
  same `planned`-or-`actual` predicate, so the policy does not silently differ by data source.
- A platform's board can now legitimately contain a train that is no longer physically at that
  platform. Anything consuming the board has to treat "listed here" as "relevant to this platform",
  not as "physically here right now" — the `changed`/`actual` fields carry that distinction, and
  a consumer that ignores them will silently mislabel a moved train as still due at the old
  platform.
- **Failure mode to watch:** until the follow-up rendering/rotation work exists, a changed-away
  entry is currently indistinguishable on screen from any other entry — that is a known, accepted
  gap, not a defect in this decision, which only concerns whether the data is still there to render
  correctly once that work happens.

**Addendum (2026-10-02) — the repositioning.** The follow-up turned out not to depend on a
design's layout: every design has a main slot and following rows, so the rule sits in the view
model that fills them, not in each design. On a platform display, an entry that changed away
from that platform never becomes the main train; it moves to the top of the following trains,
ahead of those that stay, and the next train that really leaves from here takes the main slot.
Several such entries keep their time order among themselves. A station-wide display has no
platform to leave and keeps plain time order. The designs mark the row — V4 inverts it and
names the new platform, V3 runs "Heute von Gleis 4" behind it — so the gap named above is
closed.

## Pros and Cons of the Options

### O01 — Match the actual platform only

The board includes an entry exactly while its current actual platform equals the configured one.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Announce a change | Con — the entry disappears the moment it stops matching, with nothing on screen explaining why |
| D02 | Narrows over time | Pro — trivially, an entry leaves as soon as it no longer matches |
| D03 | No new data needed | Pro — uses only the actual platform, already present |

### O02 — Keep indefinitely once matched

Once an entry has ever matched the configured platform, it stays on that board regardless of later
changes.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Announce a change | Pro — nothing that once belonged here ever disappears |
| D02 | Narrows over time | Con — the board accumulates history instead of reflecting the platform's current relevance; existing relevance-window filtering (past/horizon) would have to do all the narrowing alone, which is a different concern |
| D03 | No new data needed | Pro — implementable, though it would need tracking "ever matched" rather than reading current state |

### O03 — Match planned or actual

The board includes an entry when either its planned or its actual platform equals the configured
one.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Announce a change | Pro — a train planned here that moved elsewhere stays, carrying the new platform and the changed flag |
| D02 | Narrows over time | Pro — an entry that was never planned here and never moved here still never appears; nothing accumulates beyond the two platforms actually involved in a given change |
| D03 | No new data needed | Pro — `planned`, `actual` and `changed` are already modeled fields |
