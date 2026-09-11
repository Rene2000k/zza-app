# ADR-0008 — Fetch plan hours with a fixed 120-minute look-back, cached per hour

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-11

## Context and Problem Statement

The departure data source (IRIS) splits a board across two kinds of document. The schedule comes
from `plan/{eva}/{yymmdd}/{hh}`, one Europe/Berlin wall-clock hour per request, and carries the train
(category, number, line), planned time, planned platform and route. The live deviations come from
`fchg/{eva}`, one document for the whole day, and normally carry only what changed — changed time,
platform, route, cancellation, messages — but not the train or its destination. The two are joined
by the stop id. A train therefore only appears on the board if its plan hour was fetched.

The first implementation fetched plan hours from the hour of "now" to the end of the display
horizon. That loses every train planned before the current hour that is delayed into the display
window. Example: at 15:04, a train planned for 14:54 and 15 minutes late departs at 15:09 and
belongs on the board, but its entry sits in the 14:00 plan hour, which was never fetched. The
changed time for it is in `fchg`, but without the plan entry there is nothing to attach it to.
A real case in the recorded data: RB 15735 at Bad Vilbel on 2026-09-10, planned 16:58, expected
17:04 — missing from any board requested between 17:00 and 17:04.

Fixing this means fetching earlier hours as well, which costs requests. The display polls all day,
once per poll interval (default 30 s), per user and device.

Caching headers measured on 2026-09-11 (Bad Vilbel, 8000760):

| Endpoint | `Cache-Control` |
|---|---|
| `plan` | `must-revalidate, no-transform, max-age=86400` |
| `fchg` | `must-revalidate, no-transform, max-age=10` |
| `station` | `must-revalidate, no-transform` |

The source itself treats a plan hour as valid for a full day and the deviations as valid for
seconds. No `ETag` or `Last-Modified` is sent, so a revalidation is always a full refetch.

## Decision Drivers

| ID | Driver | Why it matters |
|---|---|---|
| D01 | A train delayed into the window appears even if it was planned in an earlier hour | A delayed train silently missing from a departure board is exactly the wrong failure for this display |
| D02 | Request budget per display | Continuous polling all day, per user; every extra request per poll is multiplied by ~2,900 polls a day at the default interval |
| D03 | Predictable limits | Which trains can be missing must be explainable in one sentence, not depend on runtime heuristics |
| D04 | Freshness of the schedule layer | Whatever is cached must not hide changes the source actually delivers |

## Considered Options

| Option | D01 | D02 | D03 | D04 |
|---|---|---|---|---|
| **O01** — Fixed look-back, plan hours cached while inside the window | Pro | Pro | Pro | Pro |
| **O02** — Adaptive look-back: step back hour by hour while `fchg` has changes in the window without a plan match | Pro | Pro | Con | Pro |
| **O03** — Fixed look-back, no cache | Pro | Con | Pro | Pro |
| **O04** — No look-back (the first implementation) | Con | Pro | Pro | Pro |

## Decision Outcome

**O01.** On every board request the IRIS adapter needs the plan hours from `now − 120 minutes` to
`now + horizon`. Because the source serves whole hours, the hour containing `now − 120 minutes` is
fetched in full, so the effective look-back is 120 to 179 minutes depending on the minute of the
hour. Each plan hour is fetched once and kept in the provider for as long as it stays inside that
window; hours that leave it are dropped, so the cache holds only the handful of hours the window
spans. `fchg` is not cached and is fetched on every poll.

Keeping a plan hour for as long as it is needed follows the source's own declared validity of a
day. A shorter refresh interval inside the app would not even reach the network in a browser, whose
HTTP cache honours the same `max-age=86400`.

The trade-off accepted is **D01's bound**: a train planned more than the look-back before now is
missing even if it is delayed into the window. Delays of two hours and more are rare enough on a
departure board to accept that, and the bound is a single constant.

Budget at the default settings (30 s poll, 120-minute horizon, so a window of four to five hours):

| | Requests per poll | Per day and display |
|---|---|---|
| First implementation (no look-back, no cache) | 3 plan + 1 fchg | ~11,500 |
| O03 (look-back, no cache) | 5 plan + 1 fchg | ~17,300 |
| **O01 (look-back, cache)** | 1 fchg, plus one plan fetch per hour entering the window | **~2,900** |

**Consequences.**

- The board now also receives entries that already departed within the look-back; trimming to what
  is still relevant stays the job of the domain's relevance window (expected time, not planned
  time), as before.
- If the source turns out to change a plan hour during the day, the cache would hide that until the
  hour leaves the window — as would any browser, given the source's own caching header. It is not
  known whether this happens; trains added at short notice may instead arrive only through `fchg`,
  with full plan data inside the deviation record, which one recorded stop suggests. That question
  is open and has to be researched separately; the answer may add a refresh rule here or a second
  entry path in the mapping.
- **Failure mode to watch:** a stop in `fchg` whose changed time falls inside the window but which
  has no matching plan entry. That is either a train delayed beyond the look-back or a train that
  exists only in `fchg`; both mean something is missing from the board. O02 is the fallback if the
  fixed bound proves too tight in practice.

## Pros and Cons of the Options

### O01 — Fixed look-back, plan hours cached while inside the window

Fetch plan hours from `now − 120 minutes` to the end of the horizon; keep each hour until it leaves
that window.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Delayed trains appear | Pro — covers every delay up to at least 120 minutes |
| D02 | Request budget | Pro — about one request per poll; the extra hours are fetched once, not per poll |
| D03 | Predictable limits | Pro — "trains delayed by more than two hours from an earlier hour are missing" |
| D04 | Schedule freshness | Pro — matches the source's declared validity of a day; live changes still arrive through `fchg` on every poll |

### O02 — Adaptive look-back driven by `fchg`

Fetch the current window, then step back one hour at a time while `fchg` still contains changed
times inside the window for stops that no fetched plan hour contains, up to a cap.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Delayed trains appear | Pro — goes back exactly as far as needed, up to the cap |
| D02 | Request budget | Pro — no more hours than necessary |
| D03 | Predictable limits | Con — how far back it looks depends on the data of the moment; a stop that exists only in `fchg` would drive it to the cap on every poll |
| D04 | Schedule freshness | Pro — same caching as O01 would apply |

Its detection rule is useful regardless: it is the failure-mode signal named above.

### O03 — Fixed look-back, no cache

The same window as O01, refetched in full on every poll.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Delayed trains appear | Pro — as O01 |
| D02 | Request budget | Con — about 17,300 requests a day per display, six times O01, for data the source declares valid for a day |
| D03 | Predictable limits | Pro — as O01 |
| D04 | Schedule freshness | Pro — nominally fresher, but in a browser the HTTP cache serves the same day-old copy anyway |

### O04 — No look-back

Fetch plan hours from the current hour onward only.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Delayed trains appear | Con — any train planned before the current hour is missing, however small its delay |
| D02 | Request budget | Pro — fewest plan hours |
| D03 | Predictable limits | Pro — the rule is simple, but it produces visibly wrong boards every hour |
| D04 | Schedule freshness | Pro — nothing cached |
