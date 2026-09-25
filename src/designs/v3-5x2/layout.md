# V3 5X2 — layout

The measurements behind `v3-5x2.module.css`, taken from reference imagery of the original
display. Only dimensions and colour values were taken over; the imagery is not part of the
repository.

## Grid

The original is a dot matrix of five modules across and two down. One module is 96 × 64 dots, a
1-dot dark seam separates neighbouring modules, and an 11-dot dark gap separates the two module
rows. The dots are not square (5.2 : 6.0), so the canvas converts the two directions separately:

| Size                    | Dots    | Canvas px  |
| ----------------------- | ------- | ---------- |
| one dot, across         | 1       | 2.625      |
| one dot, down           | 1       | 3          |
| module                  | 96 × 64 | 252 × 192  |
| seam between modules    | 1       | 3          |
| gap between module rows | 11      | 33         |
| canvas                  |         | 1272 × 417 |

Module _n_, counted from 0, starts at x = 255 · n. The upper module row spans y 0–192, the lower
one y 225–417. The resulting ratio of 3.05 : 1 is within 1 % of the original's 3.02 : 1.

## Bands

Upper module row, in dots from the top:

| Module | y     | Field                                                    |
| ------ | ----- | -------------------------------------------------------- |
| 1      | 0–23  | departure time                                           |
| 1      | 24–39 | train; halt boxes H+ / H− right-aligned, see below       |
| 1      | 40–63 | platform sections and coach strip, only with a formation |
| 2–4    | 0–15  | running line for the main train                          |
| 2–4    | 16–31 | via stops                                                |
| 2–4    | 32–63 | destination, or origin for a train ending here           |
| 5      | 0–47  | platform                                                 |
| 5      | 48–63 | platform section — no data source yet, left empty        |

Lower module row:

| Module | y               | Field                                             |
| ------ | --------------- | ------------------------------------------------- |
| 1      | 64–79           | label "Folgezüge:"                                |
| 1      | 80–103, 104–127 | time; deviation right-aligned at the module edge  |
| 2      | 80–103, 104–127 | train                                             |
| 3–4    | 80–103, 104–127 | destination, or origin                            |
| 5      | 80–103, 104–127 | running line for that train, the same as above it |

There is no footer line: on the real display the bottom band belongs to the second following
train. Inverted fields are 16 dots tall and sit vertically centred in the 24-dot rows.

## Colour

| Token        | Value     | Use                                   |
| ------------ | --------- | ------------------------------------- |
| `--v3-lit`   | `#0c30a8` | module surface                        |
| `--v3-ink`   | `#eeeeee` | text; surface of inverted fields      |
| `--v3-unlit` | `#0b0a45` | seams and the gap between module rows |

The original has two colours and no warning colour. Inversion is its only emphasis.

## Type

Type is set by cap height, which is measurable on the original and independent of the typeface;
the stylesheet converts it to `font-size` through the family's cap ratio (ADR-0010).

| Field                                       | Cap height (dots) | Canvas px |
| ------------------------------------------- | ----------------- | --------- |
| platform section letters                    | 7                 | 21        |
| running lines, via, train, deviation, label | 10                | 30        |
| following trains' time and destination      | 14                | 42        |
| departure time                              | 17                | 51        |
| destination                                 | 21                | 63        |
| platform                                    | 42                | 126       |

## Choices the imagery does not settle

- **The main train's delay** has no field of its own. It runs in the main running line as
  "Verspätung ca. 10 Min.", rounded down to five minutes, so nothing is said below five; only the
  following rows carry a "+7" field.
- **What runs in the running lines** is a selection: cancellation, replacement, the delay and a
  platform change. Delay causes and disruption reports do not. Quality notices — missing coaches,
  no bicycles, no restaurant, a skipped stop — belong there too, but the source's notices of that
  kind are not mapped yet.
- **Several notices** are joined by " +++ " and the line also ends on one, so it reads the same when
  it starts over. A single notice stands alone.
- **A train ending here** shows "Bitte nicht einsteigen" in the via line and "Fahrt endet hier" in
  its running line; behind a following train it reads "Zug endet hier".
- **Halt boxes** (ADR-0013). No photograph shows H+ or H− on this generation. They stand where
  V4 puts them — right of the main train's name, 16 dots tall like the train band, 2 dots apart
  and 2 dots in from the module edge; a long name is squeezed rather than covered. The time band
  is too narrow for two of them beside "10:57". The following rows have no free field and carry
  the change in their running line only. The running lines word the change either way.
- **Running speed** — about 40 dots per second, an estimate. Still images cannot show it.
- **Notices about the data** (stale, no answer) take the main running line when no train text runs
  there. The original shows nothing of the kind; the replica would otherwise hide a data outage.
- **Resting state.** Without a train the time field stays empty; the display shows no clock there.

## Deliberately not reproduced

- The dots themselves (ADR-0010). Seams and gap are drawn; the matrix is not.
- Blinking — the original does not blink.
- Pictograms other than the halt boxes, such as the S-Bahn logo or coach symbols, which wait for
  a later step.
