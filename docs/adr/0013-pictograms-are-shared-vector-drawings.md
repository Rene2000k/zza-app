# ADR-0013 — Pictograms are shared vector drawings, picked by id

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-24

## Context and Problem Statement

Besides text, the real platform displays show small pictograms next to a train. The first ones to be
reproduced mark a halt change: an inverted box with "H" and a raised "+" for a train calling at
additional stops, the same with "−" for a train that skips stops. Photographs of the V4 generation
show them to the right of the main train's departure time and in the following-train rows; the V3
generation uses them as well. More will follow — "bicycle carriage requires a reservation" (an
outlined box with "R" and a bicycle) is already on the photographs — and some of them are drawings
that no character of a font can stand in for.

Two earlier decisions bound the answer. ADR-0010 draws the dot-matrix displays with an outline font
instead of a reproduced matrix, so the replica is deliberately sharper than the original. ADR-0009
shares a block only where it owns a mechanism a design must not re-implement, and leaves every
choice between true renderings — including where a field sits — to the design.

The question: how is a pictogram drawn, and where does the knowledge of which pictogram an entry
gets live?

## Decision Drivers

| ID  | Driver                     | Why it matters                                                                     |
| --- | -------------------------- | ---------------------------------------------------------------------------------- |
| D01 | Covers real drawings       | Pictograms like the bicycle are not text; one technique should serve all of them   |
| D02 | Consistent with ADR-0010   | Pictograms next to outline text must not look like a different rendering technique |
| D03 | Takes look from the design | Colours and size belong to each design; the same pictogram appears on V3 and V4    |
| D04 | Drawn and assigned once    | Several designs show the same pictogram for the same fact; copies drift apart      |

## Considered Options

| Option                                                     | D01 | D02   | D03 | D04   |
| ---------------------------------------------------------- | --- | ----- | --- | ----- |
| **O01** — Shared inline SVG block, picked by id            | Pro | Pro   | Pro | Pro   |
| **O02** — Text in an inverted field ("H" + `<sup>+</sup>`) | Con | Pro   | Pro | Undec |
| **O03** — Dot-matrix bitmaps, one rect per dot             | Pro | Con   | Pro | Pro   |
| **O04** — Image files per pictogram                        | Pro | Undec | Con | Undec |

## Decision Outcome

Chosen: **O01**.

A shared block `Pictogram` in `components/zza/` draws a pictogram named by id (`'haltPlus'`,
`'haltMinus'`, extended one id at a time) as inline SVG. It paints with `currentColor` and sizes
itself in `em`, so a design sets colour and cap height the way it does for text and places the block
wherever its layout says. The block knows no design and no domain type.

Which pictograms an entry gets is a rule, not a rendering choice, and is written once as a pure
function next to the block: `additionalStops` gives H+, `skippedStops` and `endsEarly` give H−, and
an entry with both kinds of change gets both, H+ before H−. The domain model stays free of
pictograms; the function reads the existing `routeChanges` (ADR-0012). A pictogram adds to the
running line's text, it does not replace it.

**Accepted trade-off.** The pictograms are redrawn by hand as vectors rather than copied dot for dot,
so they are an interpretation of the original, as the text already is.

**Consequences.** A new pictogram costs one drawing and one id; a design only decides where it
stands. If two designs ever need different drawings for the same id, that shows up as a variant
prop on the block — the fallback ADR-0009 names for a single field.

## Pros and Cons of the Options

### O01 — Shared inline SVG block, picked by id

| ID  | Driver                     | Assessment                                               |
| --- | -------------------------- | -------------------------------------------------------- |
| D01 | Covers real drawings       | Pro — any shape can be drawn                             |
| D02 | Consistent with ADR-0010   | Pro — vector, as sharp as the outline text beside it     |
| D03 | Takes look from the design | Pro — `currentColor` and `em` inherit from the placement |
| D04 | Drawn and assigned once    | Pro — one drawing, one assignment function               |

### O02 — Text in an inverted field

Cheapest for H+ and H−, which are letters.

| ID  | Driver                     | Assessment                                                   |
| --- | -------------------------- | ------------------------------------------------------------ |
| D01 | Covers real drawings       | Con — fails at the bicycle, forcing a second technique later |
| D02 | Consistent with ADR-0010   | Pro — it is the same font                                    |
| D03 | Takes look from the design | Pro — inherits like any text                                 |
| D04 | Drawn and assigned once    | Undec — possible, but each design would set up its own field |

### O03 — Dot-matrix bitmaps

Each pictogram as a grid of lit dots, rendered as SVG rects.

| ID  | Driver                     | Assessment                                     |
| --- | -------------------------- | ---------------------------------------------- |
| D01 | Covers real drawings       | Pro — any shape the hardware can show          |
| D02 | Consistent with ADR-0010   | Con — a visible matrix beside matrix-free text |
| D03 | Takes look from the design | Pro — `currentColor` works on rects as well    |
| D04 | Drawn and assigned once    | Pro — shared like O01                          |

### O04 — Image files per pictogram

| ID  | Driver                     | Assessment                                                            |
| --- | -------------------------- | --------------------------------------------------------------------- |
| D01 | Covers real drawings       | Pro — any shape                                                       |
| D02 | Consistent with ADR-0010   | Undec — depends on how the files are drawn                            |
| D03 | Takes look from the design | Con — an `<img>` cannot take the design's colour; one file per colour |
| D04 | Drawn and assigned once    | Undec — files are shared, the assignment is not addressed             |
