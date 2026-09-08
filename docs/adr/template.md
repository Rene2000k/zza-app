# ADR-NNNN — <decision in one line>

- **Status:** proposed | accepted | rejected | superseded by ADR-NNNN
- **Deciders:** <who decides; the maintainer — agents only prepare>
- **Date:** YYYY-MM-DD

## Context and Problem Statement

What is the situation, and what forces a decision? Name the binding constraints — rate limits,
missing fields in an API, licensing, hardware, deadlines — and the facts a reader needs to judge the
outcome: measurements, error messages, dates.

Write this so it stands on its own: no references to internal planning or working documents. If a
constraint comes from elsewhere, state the constraint here rather than pointing at it.

## Decision Drivers

The criteria the options are judged by. Each gets an ID, because the tables below refer to them.
Only list drivers that can actually separate the options — a driver every option satisfies equally
is noise.

| ID | Driver | Why it matters |
|---|---|---|
| D01 | … | … |
| D02 | … | … |

## Considered Options

Every option gets an ID and appears in the comparison table. Options that were dismissed without
serious evaluation belong here too, with the reason — that is what makes the record useful later.

| Option | D01 | D02 | … |
|---|---|---|---|
| **O01** — … | Pro | Con | Undec |
| **O02** — … | Con | Pro | Pro |

Ratings: **Pro** (satisfies the driver), **Con** (violates it), **Undec** (unclear, not measured, or
irrelevant for this option — say which in the per-option table below).

## Decision Outcome

While the status is `proposed`: the **recommendation** and why it wins, phrased so the maintainer can
accept or reject it without reading anything else. Once accepted: the decision, in the active voice
and specific enough to be checkable in the code ("Departures are fetched through …, configured with
…"), including version numbers where they matter.

Name the trade-off that was accepted, not just the winner — which driver is being sacrificed, and why
that is acceptable here.

**Consequences.** What becomes easy, what becomes hard, what has to be watched from now on, and what
has to be rebuilt if this breaks. State the failure mode: how will we notice that this decision
stopped working, and which option is the fallback?

## Pros and Cons of the Options

### O01 — <option name>

One or two sentences on what this option actually is.

| ID | Driver | Assessment |
|---|---|---|
| D01 | … | Pro — … |
| D02 | … | Con — … |

Additional notes where the table is too coarse: measurements, caveats, conditions under which the
assessment would change.

### O02 — <option name>

…
