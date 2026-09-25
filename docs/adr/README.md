# Architecture Decision Records

Why a decision was made, kept next to the code it constrains. When an ADR is required, and who gets
to decide, is defined in [AGENTS.md](../../AGENTS.md#architecture-decision-records-adr) — this file
only covers the mechanics.

## Index

| #                                                                  | Title                                                                            | Status   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)                      | Record architecture decisions in ADRs                                            | accepted |
| [0002](0002-use-iris-as-primary-departure-data-source.md)          | Use IRIS as the primary departure data source                                    | accepted |
| [0003](0003-terminating-trains-share-the-departure-board.md)       | Terminating trains share the departure board                                     | accepted |
| [0004](0004-all-time-flows-through-a-clock-port.md)                | All time flows through a clock port                                              | accepted |
| [0005](0005-via-line-shows-a-fixed-count-subset.md)                | Via line shows a fixed-count subset, kept full in the domain model               | accepted |
| [0006](0006-platform-filter-keeps-entries-that-changed-away.md)    | A platform-filtered board keeps entries that changed away from that platform     | accepted |
| [0007](0007-parse-iris-xml-with-native-domparser.md)               | Parse IRIS XML with the runtime's native DOMParser                               | accepted |
| [0008](0008-plan-hours-with-look-back-and-cache.md)                | Fetch plan hours with a fixed 120-minute look-back, cached per hour              | accepted |
| [0009](0009-shared-blocks-own-mechanism-designs-choose-wording.md) | Shared display blocks own mechanism, designs choose what is printed              | accepted |
| [0010](0010-draw-dot-matrix-displays-with-a-condensed-web-font.md) | Draw dot-matrix displays with a free condensed web font, not a reproduced matrix | accepted |
| [0011](0011-quality-messages-carry-a-topic.md)                     | Quality messages are their own kind and carry a topic                            | accepted |
| [0012](0012-halt-changes-carry-stops-not-text.md)                  | Halt changes are derived from the path comparison and carried as stops, not text | accepted |
| [0013](0013-pictograms-are-shared-vector-drawings.md)              | Pictograms are shared vector drawings, picked by id                              | accepted |

Keep this table in sync in the same commit that adds an ADR. Newest entries at the bottom.

## Writing one

1. Take the next free number (highest in the index + 1, four digits, never reuse a number — not even
   for a rejected or abandoned draft).
2. Copy [template.md](template.md) to `NNNN-short-slug.md`. The slug is the decision in 2–5 words,
   kebab-case, e.g. `0002-use-db-vendo-client-as-primary-provider.md`.
3. Fill it in with status **`proposed`**, including a recommendation and the reasoning behind it.
   If it grows well past a page, the decision probably hides two decisions — split it.
4. **Present it to the maintainer and let them decide.** Only their answer changes the status to
   `accepted` (or `rejected`). Agents do not accept their own ADRs.
5. Add a row to the index above.
6. Commit it: together with the implementing change if the decision is being implemented now, or as
   its own commit if it was settled ahead of any implementation.

## Structure

The template follows a MADR-style outline; keep the section names and their order so ADRs stay
comparable:

| Section                       | Holds                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metadata                      | Status, deciders, date                                                                                                                                                            |
| Context and Problem Statement | The situation, the binding constraints, the question being decided                                                                                                                |
| Decision Drivers              | The criteria, one per row, with IDs `D01…` — only criteria that actually separate the options                                                                                     |
| Considered Options            | Options with IDs `O01…`, plus one comparison table rating every option against every driver (**Pro** / **Con** / **Undec**)                                                       |
| Decision Outcome              | The recommendation (while `proposed`) or the decision (once `accepted`), the trade-off accepted, and a **Consequences** paragraph naming the failure mode and the fallback option |
| Pros and Cons of the Options  | One subsection per option: what it is, an assessment table over all drivers, and notes where the table is too coarse                                                              |

Driver and option IDs are local to one ADR — `D01` in ADR-0004 has nothing to do with `D01` in
ADR-0007.

## Status values

- `proposed` — written down, not yet decided. The normal starting state for anything an agent drafts,
  and the right state for a decision that has to be settled before work can start.
- `accepted` — decided by the maintainer and in effect. The code follows it.
- `superseded by ADR-NNNN` — replaced. The file stays as it is; only the status line changes.
- `rejected` — considered and deliberately not done. Worth keeping when someone is likely to propose
  it again.

## Rules that matter

- **Self-contained.** An ADR must be understandable on its own, for someone who sees only this
  directory. No references to internal planning or working documents — restate the relevant context
  instead of linking to it.
- **Never rewrite history.** An ADR records what was decided at a point in time with the information
  available then. Being wrong later is normal and does not make the record wrong. Fix typos, not
  reasoning.
- **Write the measurements, not just the verdict.** "Provider X, because it was the only one still
  answering on 2026-09-10, at ~1 request / 10 s without blocking" is useful. "Provider X, because it
  is the best" is not.
- **Name what was rejected and why.** The rejected alternatives are the most valuable part when the
  chosen option later breaks — especially with the DB APIs, where the primary source may need to be
  swapped at short notice.
- **One decision per file**, so it can be superseded on its own.
