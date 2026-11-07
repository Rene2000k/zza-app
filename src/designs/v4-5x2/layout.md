# V4 5X2 — layout

The measurements behind `v4-5x2.module.css`, taken from reference imagery of the original
display: two clean renderings for the grid and the type, photographs for the horizontal columns
and for what the display shows in which situation. Only dimensions and colour values were taken
over; the imagery is not part of the repository.

## Grid

V4 sits in the same housing of five modules across and two down as V3, but behind it is an LCD,
not a dot matrix: text does not snap to the modules, and the text column starts inside the
second one. In the renderings a module is 153.5 × 103 px, a seam 1.5 px and the gap between the
module rows 20 px. The canvas converts at 1.5625:

| Size                    | Rendering px | Canvas px  |
| ----------------------- | ------------ | ---------- |
| module                  | 153.5 × 103  | 240 × 160  |
| seam between modules    | 1.5          | 2          |
| gap between module rows | 20           | 31         |
| canvas                  | 771 × 226    | 1208 × 351 |

Module _n_, counted from 0, starts at x = 242 · n. The upper module row spans y 0–160, the
lower one y 191–351. The ratio of 3.44 : 1 is within 1 % of the renderings' 3.41 : 1.

## Columns

| x (canvas) | Field                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| 3–206      | train, planned time                                                       |
| 206–291    | halt boxes beside the train; expected time beside the planned time        |
| 318–336    | bracket between the two parts of a coupled train                          |
| 344–1208   | text column: running line, via stops, destination, following trains' line |
| 1060–1205  | following rows only: halt boxes, changed platform                         |

The text column starts at 1.42 module widths in the photographs and at 1.51 in the renderings;
the photographs win. Everything else horizontal is from the renderings.

## Bands

Upper module row, departure:

| y      | Left (module 1)   | Text column                                                |
| ------ | ----------------- | ---------------------------------------------------------- |
| 0–35   |                   | running line, a rule below it while it shows text          |
| 40–78  | train; halt boxes | via stops — two lines from y 0 while no running line shows |
| 68–160 | time; expected    | destination                                                |

Lower module row, departure:

| y       | Field                                                  |
| ------- | ------------------------------------------------------ |
| 193–257 | section letters and coach strip, only with a formation |
| 273–275 | rule across the full width                             |
| 275–313 | first following train                                  |
| 313–351 | second following train                                 |

**A coupled train that is split ahead** (ADR-0014) puts its second part into the lower module
row: its train on the left, its via stops in the text column at y 193, its destination below
them in the size of the upper one. A bracket joins the two destinations through the gap. The
rule moves down to y 311 and one following train remains. The second part has no time — both
leave together. That is how the rendering "Zusammenabfahrt" shows it.

Both via lists mark the split with the split pictogram, an item of its own right after the stop
where the parts separate: "Friedland (Han) - Eichenberg - ⊐⁞⊏ - Witzenhausen Nord", as a
photograph shows it. The split is announced in the first part's running line only; a notice that
concerns the second part alone takes the place of its via stops, above a rule.

**A train ending here** keeps the train, the time and the expected time where a departure has
them. The text column shows "Bitte nicht einsteigen" in the via band with a rule below it to the
right edge, and "von Düren" in small type at y 82–120; the full-width band at the top carries the
notices. The lower module row says "Zug endet hier" in large type at y 182–264, above the rule
and the two following trains in their usual places.

The two photographs of a train ending here put its time into the lower module row beside "Zug
endet hier" and draw no rule above the following trains. The replica departs from them on
purpose: the time stays where a traveller finds it for every other train, and the rule keeps the
following trains apart as it does for a departure.

## Colour

| Token        | Value     | Use                                     |
| ------------ | --------- | --------------------------------------- |
| `--v4-lit`   | `#0d2ca2` | surface                                 |
| `--v4-ink`   | `#fefefe` | text, rules; surface of inverted fields |
| `--v4-unlit` | `#030b26` | seams and the gap between module rows   |

Like V3, two colours and no warning colour. V4 adds the rule as a second means of emphasis.

## Type

Set by cap height, converted to `font-size` through the family's cap ratio (ADR-0010).

| Field                                                   | Cap (rendering px) | Canvas px |
| ------------------------------------------------------- | ------------------ | --------- |
| section letters                                         | 10                 | 16        |
| running line, train, via, following rows, expected time | 15                 | 23        |
| time, destination, "Zug endet hier"                     | 37                 | 58        |

Time and destination share one size, unlike V3. The following trains are set in the small size,
not in a size of their own.

## Choices the imagery does not settle

- **Running line or banner.** The photographs show two kinds of top band: a train's notices in
  the text column with a rule below, and a full-width inverted band. Which message goes where
  on the original is not visible; here, train notices take the ruled line, and the inverted band
  carries notices about the data — and every notice for a train ending here, whose layout has no
  ruled line at the top.
- **What runs** is V3's selection: cancellation, replacement, a split, route changes, a platform
  change and the quality topics of ADR-0011. The main train's delay is not worded — the
  expected-time box states it. A second part has no time field, so its own line words its delay
  as V3 does, "Verspätung ca. 10 Min.", rounded down to five minutes.
- **The expected time** shows from the first full minute of delay, for the main train and the
  following trains alike, and never for a cancelled one.
- **Via stops** — four on one line, six when they may take the running line's band as well. The
  photographs show two to five. A line breaks between two stops only, and the separator stays at
  the end of the line.
- **Following trains** read "ICE 1028 · Köln Hbf · via Bonn Hbf · notices", with one via stop and
  a wide space between the parts; a line that does not fit runs and ends on " +++". A train
  ending here reads "Ankunft von Köln Hbf", one of the two wordings in the photographs; the other
  is "Zug endet hier von Horrem".
- **Inverted rows.** A cancelled following train is inverted and marked "×" before its time; one
  that changed away from this platform is inverted and shows the track switch and "Gleis 6" at
  the right end. Both stand in the top rows: the view model puts them ahead of the trains that
  leave here and never makes them the main train (ADR-0006), as the photographs "gleiswechsel"
  and "Ausfall" show. Route changes add their halt boxes at the right end too.
- **Coupled trains.** The first part runs "Zug wird in Gießen geteilt", V3's wording. The
  rendering reads "Hinterer Zugteil nur bis Hof Hbf!", which needs the order of the parts in the
  train; the source does not give it. Where one part does not run, nothing is announced or
  marked.
- **"Zug endet hier"** in large type, as one photograph shows it; another reads "Ankunft".
- **Data notices** ("Derzeit keine Zugdaten", "Daten nicht aktuell") take the inverted band only
  while no train text needs the top band. The original shows nothing of the kind.
- **Resting state.** Without a train the display stays empty: no clock, no rule.

## Deliberately not reproduced

- The pixel structure of the LCD and the antialiasing of its font (ADR-0010).
- Pictograms beside the main train other than the halt boxes — the bicycle reservation box of the
  rendering, for one — and the platform sections at the end of a following row ("F-A"). The
  source gives neither.
- A two-line train label for coupled arrivals ("IC 60470" over "NJ 470"). Parts that end here
  together are listed as one entry (ADR-0014).
