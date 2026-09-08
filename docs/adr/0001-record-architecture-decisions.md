# ADR-0001 — Record architecture decisions in ADRs

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-08

## Context and Problem Statement

The project's riskiest area is its data source. The DB has shut down the HAFAS API, and the successor
APIs are unofficial, rate-limited and change without notice. When the primary source breaks, the
difference between "swap one adapter" and "start the evaluation over" is whether the original choice,
its measurements and its rejected alternatives were written down. The same holds for design decisions
(fonts, layout tolerances) and for layer boundaries: cheap to state now, expensive to reconstruct.

The work runs over a long stretch of time with gaps between sessions, and much of it is carried out by
AI agents. That adds two failure modes beyond ordinary forgetting: decisions being made silently by
whoever happens to be implementing, and rationale being invented after the fact to fit code that
already exists. Reasoning that lives only in a chat log is gone by the time it is needed.

So: where do decisions get recorded, in what form, and who is allowed to make them?

## Decision Drivers

| ID | Driver | Why it matters |
|---|---|---|
| D01 | Survives long gaps and lost sessions | Work happens in bursts weeks apart; anything that only exists in a conversation is unavailable at the moment it is needed |
| D02 | Discoverable in one predictable place | A record nobody thinks to look for has no value; a newcomer must find the reasoning without knowing it exists |
| D03 | Preserves rejected alternatives and the fallback | The DB APIs are expected to break; the second-best option and why it lost is the actual disaster plan |
| D04 | Per-decision lifecycle | A decision must be able to carry a status that changes — awaiting a decision, in effect, replaced — without disturbing the others |
| D05 | Keeps decision authority with the maintainer | Agents produce most of the text; the choice between options must stay a human one, and the format has to make that separation visible |
| D06 | Low ongoing overhead | A practice that documents trivia gets abandoned; the obligation must be scoped by a test that can be applied quickly |

## Considered Options

| Option | D01 | D02 | D03 | D04 | D05 | D06 |
|---|---|---|---|---|---|---|
| **O01** — Numbered ADR files in `docs/adr/`, MADR-style | Pro | Pro | Pro | Pro | Pro | Undec |
| **O02** — Reasoning inside the internal planning documents | Con | Con | Con | Con | Undec | Pro |
| **O03** — One growing `DECISIONS.md` log | Pro | Pro | Undec | Con | Undec | Pro |
| **O04** — Git commit messages only | Pro | Con | Con | Con | Con | Pro |
| **O05** — Agents decide and document afterwards | Undec | Undec | Con | Undec | Con | Pro |

## Decision Outcome

**O01 — numbered ADR files in `docs/adr/`, following a MADR-style structure.** It is the only option
that satisfies D02–D05 at once: one file per decision gives each its own status and supersession path,
the directory is an obvious place to look, and the explicit "Considered Options" section makes the
rejected alternatives a required field rather than an afterthought.

Three rules come with it, and are part of this decision:

1. **The maintainer decides.** Agents prepare ADRs with status `proposed`, including a recommendation,
   and then ask. Only the maintainer's answer sets `accepted`. The documentation burden sits with the
   agent, the authority with the human (D05).
2. **ADRs are self-contained.** They do not reference internal planning or working documents, so this
   directory stays readable on its own and does not rot when internal notes are rewritten (D02).
3. **Commit timing follows the work.** An ADR implemented immediately ships with its implementation;
   a decision settled ahead of implementation gets its own commit. An ADR written *after* the code it
   justifies is the anti-pattern.

The trade-off accepted here is **D06**: this is the most laborious of the five options. It is accepted
because the failure it prevents — re-running a rate-limited API evaluation from scratch — costs more
than the writing does. The overhead is bounded by the explicit triviality test in AGENTS.md, which is
what keeps the practice from spreading into variable names and formatting.

**Consequences.** Research results land as ADRs instead of scattered notes, and a broken API means
reading one ADR to find the documented fallback. Decisions surface as explicit questions rather than
appearing inside a diff — at the cost of more hand-offs, and of work occasionally waiting on an
answer; that wait is deliberate. Three signs that the practice has failed: ADRs appearing in commits
*after* the code they justify (rationalisation), agents quietly implementing what should have been a
`proposed` ADR (D05 breached), and `proposed` ADRs piling up unanswered (the practice then stalls the
work instead of documenting it). If the overhead does prove unsustainable, O03 is the fallback — it
keeps D01/D02 and loses D04.

## Pros and Cons of the Options

### O01 — Numbered ADR files in `docs/adr/`, MADR-style

One file per decision, sequentially numbered, with a fixed structure: context, drivers, options,
outcome. Mechanics in `docs/adr/README.md`, obligation and triviality test in `AGENTS.md`.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Survives gaps | Pro — plain files in the repo, versioned with the code |
| D02 | Discoverable | Pro — one directory, one index table, stable naming |
| D03 | Alternatives preserved | Pro — "Considered Options" is a required section, not a nicety |
| D04 | Per-decision lifecycle | Pro — status per file; supersession by adding a file, not editing one |
| D05 | Human authority | Pro — the `proposed` status makes "prepared but not decided" a first-class state |
| D06 | Low overhead | Undec — the heaviest option; depends entirely on the triviality test holding |

The format is deliberately close to MADR so that the structure is familiar and does not have to be
re-invented per ADR.

### O02 — Reasoning inside the internal planning documents

Keep the rationale in the phase-by-phase working documents, next to the tasks that produced it.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Survives gaps | Con — those documents are rewritten as work proceeds; decisions get edited away with the tasks around them |
| D02 | Discoverable | Con — the material is internal and not intended to be shared, so the reasoning would be unavailable to anyone reading only the repository's documentation |
| D03 | Alternatives preserved | Con — nothing forces alternatives to be listed; in practice only the outcome survives |
| D04 | Per-decision lifecycle | Con — no per-decision status; superseding means silently editing prose |
| D05 | Human authority | Undec — nothing in the format either enforces or prevents it |
| D06 | Low overhead | Pro — zero extra structure; the reasoning is written where the work happens |

This is the status quo that prompted the ADR: a decision must outlive the plan that produced it.

### O03 — One growing `DECISIONS.md` log

A single chronological file, one section appended per decision.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Survives gaps | Pro — versioned file in the repo |
| D02 | Discoverable | Pro — a single well-known filename |
| D03 | Alternatives preserved | Undec — possible, but nothing structural requires it |
| D04 | Per-decision lifecycle | Con — no per-entry status; marking one entry superseded means editing history in place, and "awaiting a decision" cannot be expressed cleanly |
| D05 | Human authority | Undec — not addressed by the format |
| D06 | Low overhead | Pro — lowest ceremony of the written options |

Viable, and the designated fallback if per-file ADRs prove too heavy. The real cost appears at scale:
the file becomes an unnavigable log with no way to tell current from obsolete.

### O04 — Git commit messages only

Rely on commit bodies to carry the reasoning, and on `git log` to retrieve it.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Survives gaps | Pro — immutable and always present |
| D02 | Discoverable | Con — nobody greps the log to ask why a library was chosen; the answer is unfindable unless you already know which commit to look at |
| D03 | Alternatives preserved | Con — commit messages describe a change, not the options rejected around it |
| D04 | Per-decision lifecycle | Con — a commit message cannot be updated; a superseded decision stays silently in effect in the log |
| D05 | Human authority | Con — the decision is only visible once it has already been implemented |
| D06 | Low overhead | Pro — no extra artefact |

Commit messages remain valuable, but as a record of a change, not of a decision.

### O05 — Agents decide and document afterwards

No ADR obligation: whoever implements chooses, and writes an explanation if it seems warranted.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Survives gaps | Undec — depends entirely on whether anything was written that time |
| D02 | Discoverable | Undec — no defined location |
| D03 | Alternatives preserved | Con — after-the-fact rationale describes the code that exists, not the trade-off that was faced |
| D04 | Per-decision lifecycle | Undec — no artefact to carry a status |
| D05 | Human authority | Con — moves architectural authority to whoever happens to be implementing |
| D06 | Low overhead | Pro — the fastest option, which is its only real argument |

Rejected on D05 primarily: the point of this ADR is that the choice stays human, and this option
removes exactly that.
