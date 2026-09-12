# ADR-0009 — Shared display blocks own mechanism, designs choose what is printed

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-12

## Context and Problem Statement

The project recreates several generations of German railway platform departure displays. Each
generation is rebuilt as a _design_; a set of generic React blocks (departure time, delay,
destination, platform, following-train row, …) was meant to be shared by all designs, with a design
contributing layout and look only.

Building the first block set disproved that split. Two generations print different, equally true
statements from the same data:

- the V3 generation prints the deviation from the timetable, "+7", in its delay field, while the V4
  generation prints the actual departure time, "10:57", in the same place;
- whether the leading time field shows the timetabled or the expected time differs the same way;
- wording differs ("Zug endet", "von Dieburg"), as does which parts a following-train row contains
  and in which order.

A shared block that decides any of this carries one generation's habits into common code, and every
further generation widens it by another switch. The blocks written so far did exactly that: the
delay block could only say "+7", and one block had already grown a `show` prop to paper over the
same problem.

At the same time, some things must _not_ be re-implemented per design: the running message line,
fitting a name into a fixed field, blinking, drawing the coach strip — and rules that are decided
once, such as "a delay under a full minute counts as on time", "a message code the project cannot
resolve renders as nothing, never as a bare number", and the bounded selection of via stops.

The question this record settles: where does the boundary run between shared display code and a
design?

## Decision Drivers

| ID  | Driver                                      | Why it matters                                                                                  |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| D01 | Faithful reproduction of each generation    | The goal is a replica of real hardware; a generation must not be bent to fit a shared component |
| D02 | Rules must not drift between designs        | Delay rounding, unresolved codes and via selection are display-independent and decided once     |
| D03 | Cost of adding a design                     | Further generations are planned; adding one must stay cheap                                     |
| D04 | Shared code free of per-generation switches | Every switch makes each design a possible cause of another design's defect                      |
| D05 | Testable without React                      | A rule tested as a function is cheaper and more precise than one tested through rendered markup |

## Considered Options

| Option                                                                      | D01   | D02 | D03   | D04 | D05 |
| --------------------------------------------------------------------------- | ----- | --- | ----- | --- | --- |
| **O01** — Blocks with variant props                                         | Undec | Pro | Pro   | Con | Con |
| **O02** — Blocks for mechanism and rules only, formatting as pure functions | Pro   | Pro | Undec | Pro | Pro |
| **O03** — One component set per design, nothing shared                      | Pro   | Con | Con   | Pro | Con |

## Decision Outcome

Recommended: **O02**, as the rule

> A shared block exists only where it owns a mechanism a design must not re-implement — the running
> message line, text fitting, blinking, the coach strip — or a rule that belongs to the domain.
> Everything that is a choice between several true renderings belongs to the design. The facts come
> from pure formatting functions (`formatClockTime`, `formatDelay`) and from the domain model
> (`selectViaStops`, `headlineStation`, `delayMinutes`, `displayableMessages`, `isSamePlatform`).

Under this rule the delay field is not a shared component at all: one design renders
`formatDelay(time)`, another renders `formatClockTime(time.expected)`, and neither has to know the
other exists. What stays shared is the rule that "on time", "early" and "less than a minute late"
all print nothing.

**Trade-off accepted: D03.** A new design writes more of its own markup — a span and a class per
field — instead of composing ready-made blocks. That is the price for D01 and D04, and it is a
small price: the fields are one line each, while the expensive parts (scrolling, fitting, the coach
strip) stay shared.

**Consequences.** Designs become the only place where wording and field content live, which is also
where a reviewer compares them against a photograph of the real display. The failure mode is drift:
two designs disagreeing about a rule that should have been shared — for example about when a delay
starts counting. That shows up as duplicated logic in review or as two tests asserting the same
thing differently; the answer then is to move the rule into a formatting function, not to grow a
component. The fallback for a single field where two designs really need identical markup with only
one differing detail is O01, applied to that field alone rather than to the whole set.

## Pros and Cons of the Options

### O01 — Blocks with variant props

Every design-dependent statement becomes a prop the design must set, e.g. a delay block with
`format="plusMinutes" | "expectedTime"`, a destination block with a configurable prefix, a hint
block taking a wording table.

| ID  | Driver                     | Assessment                                                                                                                                                  |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Faithful reproduction      | Undec — works as long as a generation's need fits an existing prop; a genuinely different field forces either a new variant or a departure from the replica |
| D02 | No rule drift              | Pro — the rules sit in the shared block                                                                                                                     |
| D03 | Cost of a design           | Pro — a design mostly places blocks and passes props                                                                                                        |
| D04 | No per-generation switches | Con — the switches are the design of this option; the shared set grows with every generation                                                                |
| D05 | Testable without React     | Con — the rules are only reachable through rendering                                                                                                        |

The prop tables also become a second, weaker language for layout and wording, one that has to be
learnt in addition to CSS and JSX.

### O02 — Blocks for mechanism and rules only

Shared: components that own behaviour (the message line, the coach strip; later text fitting and
blinking) plus pure functions for facts. Designs render their own markup for plain fields.

| ID  | Driver                     | Assessment                                                                                        |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| D01 | Faithful reproduction      | Pro — a design is free in wording, order and markup, so no generation has to be approximated      |
| D02 | No rule drift              | Pro — the rules live in functions both designs call                                               |
| D03 | Cost of a design           | Undec — more markup per design, but no prop vocabulary to learn and no shared component to extend |
| D04 | No per-generation switches | Pro — nothing shared knows a generation exists                                                    |
| D05 | Testable without React     | Pro — formatters and domain functions are plain functions                                         |

The risk is the mirror image of O01: a rule that _should_ be shared can be re-implemented in a
design. Review has to watch for it, and the answer is a new formatting function rather than a
component.

### O03 — One component set per design

No sharing at all; each design implements everything it needs, including its own message line and
coach strip.

| ID  | Driver                     | Assessment                                                              |
| --- | -------------------------- | ----------------------------------------------------------------------- |
| D01 | Faithful reproduction      | Pro — total freedom                                                     |
| D02 | No rule drift              | Con — every rule exists once per design and drifts by construction      |
| D03 | Cost of a design           | Con — each design pays for scrolling, fitting and the coach strip again |
| D04 | No per-generation switches | Pro — trivially, since nothing is shared                                |
| D05 | Testable without React     | Con — rules end up inside components again, once per design             |
