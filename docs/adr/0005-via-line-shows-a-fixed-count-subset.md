# ADR-0005 — Via line shows a fixed-count subset, kept full in the domain model

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-10

## Context and Problem Statement

The display's via line (the row of intermediate stops between "here" and the destination) has
limited space — the display is built from a small number of physical modules, not a scrolling web
page. A real platform display does not print every intermediate stop of a long-distance train; it
shows a curated subset.

The chosen data source (IRIS) returns the full intermediate-stop path for a departure as one
pipe-separated field in the same response used for the time, platform and destination — there is no
separate request needed to get more or fewer stops, and therefore no cost difference between
showing a little of that path or all of it. The only real question is which stops end up on
screen, not which stops get fetched.

That selection needs a rule precise enough to implement and test without a judgment call baked
into the code, and it has to work with the data the source actually provides — IRIS reports station
names and the path order, nothing that ranks a station's size or importance.

## Decision Drivers

| ID | Driver | Why it matters |
|---|---|---|
| D01 | Matches how a real display curates the via line, rather than printing everything | The project's purpose is reproducing a real display |
| D02 | Deterministic, testable outcome | The rule has to be checkable in code, not a subjective "looks about right" |
| D03 | Only uses data the source actually provides | IRIS has no station-importance or interchange-significance field |
| D04 | Keeps the data layer generic across designs | A design with a wider via line should not need a data-layer change to show more stops |

## Considered Options

| Option | D01 | D02 | D03 | D04 |
|---|---|---|---|---|
| **O01** — Show every intermediate stop, unfiltered | Con | Pro | Pro | Pro |
| **O02** — Curate by a significance/interchange heuristic | Pro | Con | Con | Undec |
| **O03** — Fixed, count-based rule, applied where a design renders | Pro | Pro | Pro | Pro |

## Decision Outcome

**O03 — a fixed, count-based selection rule**, kept out of the provider adapter: the domain model
carries the **full** via list exactly as the source reports it (no stop is discarded during
mapping), and a small, reusable function picks a bounded subset for display — the first `n - 1`
stops plus the final stop immediately before the destination, whenever the full list is longer than
`n`, so the last point before arrival is never the one silently dropped. `n` is a parameter of the
function, not a fixed constant, so a design with more room can ask for more stops without any
change beneath it.

The trade-off accepted is precision: a fixed rule cannot single out the one interchange station
that actually matters in the middle of a long route the way a significance heuristic could — but a
significance heuristic needs a ranking of stations the source does not provide, so it is not a
"slightly better" version of the same idea, it is a feature this project cannot build today.

**Consequences.**

- No via data is ever lost in a provider adapter; only the presentation layer trims what it shows,
  so a second design with a different via-line width needs no data-layer change.
- The selection function needs to report how many stops it left out, not just which ones it kept,
  so a design can render an indicator (e.g. an ellipsis) instead of silently truncating.
- **Failure mode to watch:** if a future data source does not return the full via path in the same
  response the rest of a departure comes from (unlike IRIS), fetching it may cost one request per
  train — a real cost this decision did not have to weigh, because it is not IRIS's situation.

## Pros and Cons of the Options

### O01 — Show every intermediate stop

Print the full via path as delivered, however long.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Faithfulness | Con — real platform displays curate; a long via line printed in full does not match one |
| D02 | Deterministic | Pro — trivially, nothing is selected |
| D03 | Data availability | Pro — uses exactly what the source gives, nothing more |
| D04 | Design-generic | Pro — no selection logic to parameterize |

### O02 — Curate by significance/interchange heuristic

Rank stops by some notion of importance (interchange size, journey-time gaps) and show only the
highest-ranked ones.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Faithfulness | Pro — closest in spirit to what a real display actually curates for |
| D02 | Deterministic | Con — "important" needs a definition, and any definition not backed by real data is a guess dressed up as a rule |
| D03 | Data availability | Con — IRIS reports station names and path order only, no size/importance field to rank by |
| D04 | Design-generic | Undec — the ranking itself would not depend on the design, but building and maintaining a station-importance table is a standing cost independent of any design |

### O03 — Fixed, count-based rule

Keep the first `n - 1` stops plus the final stop before the destination when the full list exceeds
`n`; otherwise show it all. `n` is supplied by the caller.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Faithfulness | Pro — produces a bounded, curated-looking line; imperfect in which stops it keeps, but not exhaustive like O01 |
| D02 | Deterministic | Pro — a pure function of the via list and a count, fully unit-testable |
| D03 | Data availability | Pro — needs only the via list and the destination, both already in the domain model |
| D04 | Design-generic | Pro — `n` is a parameter, not baked into the data layer |
