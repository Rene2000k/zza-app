# Station overview — layout

The measurements behind `station-overview.module.css`, taken from four photographs of the
original: a single panel in Hamburg-Harburg, a double panel in Düsseldorf and two of a single panel
in Paderborn. Only proportions and colours were taken over; the imagery is not part of the
repository.

## Canvas

The original is one LCD in landscape, close to 16 : 9 in every photograph (one half of the
Düsseldorf panel measures 1.74 : 1), and it has no module seams. The canvas is a full-HD screen,
1920 × 1080; positions were scaled from one half of the Düsseldorf panel at 3.79 canvas px per
photograph px and rounded.

## Bands

| y        | Content                                                         |
| -------- | --------------------------------------------------------------- |
| 24–96    | clock face and time on the left; "Abfahrt Departure" from x 634 |
| 118–174  | column labels, German above English                             |
| 176–178  | rule below the labels                                           |
| 180–1080 | twelve train lines of 75 px, each with a rule along its bottom  |

## Columns

| x         | Field                                            |
| --------- | ------------------------------------------------ |
| 20–40     | dot of a train about to leave                    |
| 54–184    | planned time                                     |
| 190–306   | expected time, inverted                          |
| 316–364   | pictogram of the train's kind                    |
| 376–379   | bracket between the two parts of a coupled train |
| 390–580   | train, in a box coloured by its kind             |
| 600–1150  | via stops, or a notice inverted in their place   |
| 1170–1640 | destination                                      |
| 1660–1900 | platform, inverted when it changed               |

The rules run under each column separately, with a gap between them, as in the Paderborn
photographs.

## Colour

| Token           | Value     | Use                                     |
| --------------- | --------- | --------------------------------------- |
| `--so-lit`      | `#0d2ca2` | surface                                 |
| `--so-ink`      | `#fefefe` | text, rules; surface of inverted fields |
| `--so-regional` | `#5b6489` | box of a regional train                 |
| `--so-suburban` | `#008d4f` | box of an S-Bahn                        |

Surface and ink are the values of V4, the same LCD generation. The train boxes are the only
colour beyond them: a long-distance train stands inverted, white, as in the Hamburg-Harburg
photograph; a regional train on the grey-blue of the Paderborn photographs; an S-Bahn in a box
with round ends in the green of the S-Bahn sign. Paderborn shows its S5 in red, the colour of its
local network; one green for every network is the starting point. `serviceClass` decides the
kind: long-distance by the category, an S-Bahn by the category "S" or a line label "S" plus a
digit — IRIS gives the Hanover S5 at Paderborn the category "SBH".

## Type

Set by cap height, converted to `font-size` through the family's cap ratio (ADR-0010).

| Field                                         | Cap (canvas px) |
| --------------------------------------------- | --------------- |
| column labels                                 | 16              |
| expected time, train, via stops, notices      | 26              |
| data notice                                   | 30              |
| planned time, destination, platform           | 34              |
| header: time and "Abfahrt Departure", in bold | 44              |

"Departure" and the English column labels are italic, as in the Düsseldorf photograph.

## Choices the imagery does not settle

- **When the dots appear.** The Düsseldorf photograph shows a hollow and a filled dot before the
  time of trains about to leave, not when they change. Assumed for now: hollow from five minutes
  before the expected departure, filled from three — the expected time, since that is when the
  train goes. A cancelled train gets none; a coupled pair one, on its
  first line. The dots blink, on and off once a second, all together — estimated, since the
  photographs are stills.
- **Order.** Timetable order, as in every photograph: a delayed train keeps its place and shows
  its expected time beside the planned one. A cancelled train and one moved to another platform
  keep their place too — on this display nothing is promoted to the top.
- **The expected time** shows from the first full minute of delay, never for a cancelled train —
  as on V4.
- **Notices** stand inverted in place of the via stops, as "Ohne Halt in Köln Hbf" does in the
  Düsseldorf photograph, and run when they are too long: that the train is cancelled or replaced,
  and how its route differs today. Delays have the expected-time box and a changed platform its
  inverted field, so neither is worded. The other notices of a single train — quality notices,
  delay causes — are left to the platform displays; a board for the whole station cannot run them
  all.
- **Trains ending here** are not listed: this is a departure board. The Hamburg-Harburg
  photograph shows one part of a coupled train that ends there, as "Bitte nicht einsteigen";
  here only the part that departs stands on the board.
- **Coupled trains** stand on consecutive lines joined by a bracket, the time on the first only, as
  in the Paderborn photographs. Both via lists mark the split with the split pictogram after the
  stop where the parts separate, or at the end of the line when that stop lies beyond the ones
  shown. Below the first line, only the columns that differ between the parts are ruled off.
- **Via stops** — the next four, squeezed where they need it; the photographs show two to four.
- **Data notices** ("Derzeit keine Zugdaten", "Daten nicht aktuell") take an inverted band in
  place of the last line, where the Hamburg-Harburg panel runs its notices. The original shows
  nothing of the kind.
- **Before the first board** the display shows its header without a clock, since the time comes
  with the board.

## Deliberately not reproduced

- The DB logo in the top right corner — a trademark, and foreign graphics stay out of the
  repository.
- The airport pictogram before a destination and the bicycle box beside a platform: the source
  gives neither. The pictograms before the train are redrawn — a train front or an S in a ring,
  after the Paderborn photographs (ADR-0013).
- The welcome line with the station's name ("Willkommen am Bahnhof Hamburg Harburg") that one
  panel carries above the header, and that panel's running line for station-wide notices — the
  source delivers no notices for a whole station.
- The second half of the Düsseldorf panel, which continues the list: one panel is one display;
  a second would be a second display with an offset into the list.
