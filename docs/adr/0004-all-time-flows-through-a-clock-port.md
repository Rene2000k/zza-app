# ADR-0004 — All time flows through a clock port

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-09

## Context and Problem Statement

The display is a clock as much as it is a board: it renders the current time, computes delays against
it, decides which trains are still relevant, and switches content on timers. It also has to be
verifiable in states that occur rarely and cannot be summoned — a cancellation, a platform change, a
train ending here, midnight rollover, the switch to and from daylight saving time.

If components read the system clock directly, none of those states can be reproduced on demand. The
alternative is a single seam through which all time is read.

## Decision Drivers

| ID | Driver | Why it matters |
|---|---|---|
| D01 | Rare states must be reproducible on demand | The design work in a later phase depends on seeing delay, cancellation and rollover states without waiting for reality to produce them |
| D02 | Tests must not depend on wall-clock time | Time-dependent behaviour tested against the real clock is flaky and fails at inconvenient moments, such as midnight or a DST change |
| D03 | Retrofit cost | Introducing a seam later means finding and changing every time access in the codebase |
| D04 | Simplicity in everyday code | Reading the time must stay a one-liner, or the rule will be broken whenever it is inconvenient |

## Considered Options

| Option | D01 | D02 | D03 | D04 |
|---|---|---|---|---|
| **O01** — A clock port: one injected time source, no direct system-time access anywhere | Pro | Pro | Pro | Pro |
| **O02** — Direct system time, real-time only | Con | Con | Con | Pro |
| **O03** — Direct system time, faked in tests via timer mocking | Undec | Pro | Con | Pro |
| **O04** — Clock port plus a full replay engine over recorded data | Pro | Pro | Undec | Con |

## Decision Outcome

**O01 — a clock port.** Time is read from a single injected source. In normal operation it returns the
system time; in demo and test operation it returns a fixed or accelerated time. Nothing else in the
codebase calls `Date.now()` or `new Date()` for the current time — constructing a date from a parsed
timestamp is of course unaffected.

The rule is deliberately absolute rather than "where it matters", because a single stray direct read is
enough to make a scenario unreproducible, and such a read is invisible in review unless the rule is
categorical.

The trade-off accepted is the injection itself: every consumer needs access to the clock. That is small
here because the app already carries configuration through its layers, and it buys the ability to point
the display at any moment in time.

**Consequences.**

- The demo mode falls out almost for free: a fixed timestamp plus a fixture data set reproduces any
  display state exactly, which is what makes the layout work checkable.
- Tests of delay rounding, relevance windows and rotation cycles become deterministic.
- Timezone handling stays explicit: the clock answers "now", and all rendering happens in
  Europe/Berlin regardless of where the machine is.
- The rule needs enforcing, or it decays. A lint rule banning direct `Date.now()` / `new Date()`
  outside the clock module is the intended mechanism; without it, the failure mode is a slow drift back
  to direct reads, visible only when a scenario suddenly cannot be reproduced.
- Data freshness is measured against the clock too, so a frozen demo clock must not make live data look
  stale — the demo path pairs a fixed clock with fixture data, never with live data.

## Pros and Cons of the Options

### O01 — A clock port

One interface with a `now()` method; implementations for system time, fixed time and accelerated time.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Reproducible states | Pro — any moment can be selected, including ones that never occurred |
| D02 | Deterministic tests | Pro — no global mocking needed; pass a fixed clock |
| D03 | Retrofit cost | Pro — established before any component exists |
| D04 | Everyday simplicity | Pro — still a single call; the clock arrives with the surrounding context |

### O02 — Direct system time, real-time only

Components call the platform's date functions where needed.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Reproducible states | Con — a cancellation can only be seen when one happens to occur |
| D02 | Deterministic tests | Con — time-dependent tests become flaky, worst around midnight and DST |
| D03 | Retrofit cost | Con — the seam has to be threaded through afterwards |
| D04 | Everyday simplicity | Pro — the simplest possible code, which is its whole argument |

### O03 — Direct system time, faked in tests via timer mocking

Keep direct reads; let the test framework replace timers and the date object.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Reproducible states | Undec — works inside tests, but does nothing for a demo mode a person can look at in the browser |
| D02 | Deterministic tests | Pro — this is what fake timers are for |
| D03 | Retrofit cost | Con — no seam exists, so anything beyond tests still requires the refactor |
| D04 | Everyday simplicity | Pro — no injection anywhere |

Rejected because the demo mode is an explicit requirement, and global mocking cannot serve a running
browser session.

### O04 — Clock port plus a full replay engine

Record live data over time and replay it against a moving clock.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Reproducible states | Pro — the most faithful reproduction possible, including transitions |
| D02 | Deterministic tests | Pro — as O01 |
| D03 | Retrofit cost | Undec — it is a superset of O01 and can be added later on top of it |
| D04 | Everyday simplicity | Con — a recording format, a recorder and a player, none of which are needed to lay out a display |

Deliberately deferred rather than rejected: O01 is its foundation, so this stays available if watching
real transitions ever becomes necessary.
