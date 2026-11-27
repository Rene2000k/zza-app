# ADR-0018 — A Wagenreihung lists its coaches in platform order, with the Fahrtrichtung beside them

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-11-27

## Context and Problem Statement

`TrainFormation.coaches` lists a train's coaches with the **Zugspitze first**. The Wagenstandsanzeiger
draws them left to right in that order. It takes the Bahnsteigabschnitt letters above the coaches from
the coaches themselves, as runs of consecutive coaches in the same Abschnitt.

So far this has been invisible. The only Wagenreihung source, a local copy of fernbahn.de's directory,
gives no Bahnsteigabschnitte. Every train is placed on a generic platform with the Zugspitze at the A
end, so the Zugspitze-first list also starts at A. After a Richtungswechsel, the fernbahn provider
reverses the list so the Zugspitze leads again, and the generic placement gives out the letters
afterwards. Where the provider cannot tell the direction, it keeps the directory's order, coach 1
first.

A tagesaktuelle source with real Abschnitte, the bahnhoftafel.de API, breaks this. Measured on
2026-11-26:

- With `direction: 0` its Zugspitze points to Abschnitt A, and the first coach stands at 6–8 % of the
  platform.
- With `direction: 100` the Zugspitze points to the other end, and the first coach stands at 80–88 %.
- About half of the fifteen samples ran with `100`. ICE 596 on Frankfurt(Main)Hbf platform 9 is one of
  them: its Zugspitze, coach 14, stands in Abschnitt F.

Drawn Zugspitze first, that train reads **F E D C B A** from left to right. Every letter stands over
the right coaches, but the platform is mirrored. A real Wagenstandsanzeiger shows the platform the
same way round every time and lets the train point either way.

The model mixes two facts: the order of the coaches, and which way the train faces on the platform.
On the generic platform they always coincided. With real Abschnitte they no longer do.

The question this record settles: in what order does a Wagenreihung list its coaches, and where is
the Fahrtrichtung stated?

## Decision Drivers

| ID  | Driver                                     | Why it matters                                                                                                                                |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | The platform reads the same way every time | Travellers find their coach by Abschnitt; a strip that runs A–F for one train and F–A for the next misleads                                   |
| D02 | The display draws what the model states    | The Wagenstandsanzeiger is shared by every design and deliberately dumb; orientation logic in it is repeated wherever coaches are drawn       |
| D03 | The Fahrtrichtung is not lost              | A direction arrow is a known element of real displays; a model that drops the direction cannot draw it later                                  |
| D04 | One well-defined order                     | The cab-shape and first-class-side rules read each coach's neighbours, so the list must be in a real physical order before anyone looks at it |

## Considered Options

| Option                                                                              | D01 | D02 | D03 | D04 |
| ----------------------------------------------------------------------------------- | --- | --- | --- | --- |
| **O01** — Coaches in platform order from the A end, plus `directionOfTravel`        | Pro | Pro | Pro | Pro |
| **O02** — Coaches stay Zugspitze first, plus a direction field; the display mirrors | Pro | Con | Pro | Pro |
| **O03** — The provider reverses the list to start at A and drops the direction      | Pro | Pro | Con | Pro |
| **O04** — Coaches in any order, with a direction field; sorted later by Abschnitt   | Pro | Con | Pro | Con |
| **O05** — Keep Zugspitze first and nothing else                                     | Con | Pro | Pro | Pro |

## Decision Outcome

**Recommendation: O01.**

- `TrainFormation.coaches` lists the coaches **in platform order, from the end of Abschnitt A**.
- A new field `directionOfTravel?: 'start' | 'end'` says which end the Zugspitze points to: `'start'`
  for the end of Abschnitt A, `'end'` for the other one. It is absent when the source does not know.
- Every provider puts its coaches into this order itself, from the facts it has:
  - bahnhoftafel sorts by the coaches' platform position and maps its `direction`;
  - fernbahn sets `'start'` where it knows the segment. The Zugspitze then stands at A, as the
    generic placement assumes. It leaves the field out where it keeps the directory's order;
  - the generic placement in `withSections` keeps putting the Zugspitze at A.
- The Wagenstandsanzeiger draws the list as it comes, so Abschnitt A is always at the same side. A
  direction arrow can later be drawn from `directionOfTravel` without touching the order.

The glossary records the Fahrtrichtung under the code name `directionOfTravel`. The Zugspitze keeps
`front`.

Accepted trade-off: "the first coach is the Zugspitze" no longer holds. Code that wants the Zugspitze
has to ask `directionOfTravel`, and has no answer when the field is absent. Today nothing outside the
providers needs the Zugspitze itself. The cab-shape rules look at both ends and their neighbours,
which works in either order.

**Consequences.**

- Each provider is responsible for turning its source's order into platform order. A provider that
  gets this wrong shows the train mirrored, not broken.
- Mixing two sources inside one Wagenreihung is not possible; it never was.
- Watch out for later uses of the "first coach": a direction arrow, the Zugspitze in a scrolling text,
  the coupling point of two Zugteile. Each must read `directionOfTravel`, not the array index.
- If an orientation fixed at A turns out to be wrong for some real display generation, for example one
  that mirrors with the viewing side, the change belongs in that design's drawing. The model stays as
  it is. O02 is then the fallback for that design only.

## Pros and Cons of the Options

### O01 — Coaches in platform order from the A end, plus `directionOfTravel`

The list states where each coach stands. A separate field states which way the train faces.

| ID  | Driver                                     | Assessment                                                                                |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| D01 | The platform reads the same way every time | Pro — A is always first                                                                   |
| D02 | The display draws what the model states    | Pro — no orientation logic in the display; the provider, which has the positions, does it |
| D03 | The Fahrtrichtung is not lost              | Pro — carried as its own field                                                            |
| D04 | One well-defined order                     | Pro — platform order is physical and complete before anyone reads it                      |

### O02 — Coaches stay Zugspitze first, plus a direction field; the display mirrors

The model keeps its current order and gains a field. The Wagenstandsanzeiger reverses the list when
the Zugspitze points away from A.

| ID  | Driver                                     | Assessment                                                                            |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| D01 | The platform reads the same way every time | Pro — once the display mirrors                                                        |
| D02 | The display draws what the model states    | Con — the display reorders, and every other place that draws coaches has to repeat it |
| D03 | The Fahrtrichtung is not lost              | Pro — the order itself carries it                                                     |
| D04 | One well-defined order                     | Pro — Zugspitze first is physical too                                                 |

The smallest change today, since existing providers stay untouched. It was rejected because the work
moves into the shared display instead of the provider that knows the positions.

### O03 — The provider reverses the list to start at A and drops the direction

As O01, but without the field.

| ID  | Driver                                     | Assessment                                                |
| --- | ------------------------------------------ | --------------------------------------------------------- |
| D01 | The platform reads the same way every time | Pro — A is always first                                   |
| D02 | The display draws what the model states    | Pro — nothing to do in the display                        |
| D03 | The Fahrtrichtung is not lost              | Con — the Zugspitze can no longer be told; no arrow later |
| D04 | One well-defined order                     | Pro — platform order                                      |

### O04 — Coaches in any order, with a direction field; sorted later by Abschnitt

Providers return coaches as their source lists them, and the domain model or the display sorts them
from A onwards.

| ID  | Driver                                     | Assessment                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | The platform reads the same way every time | Pro — after sorting                                                                                                                                                                                                                                                                                           |
| D02 | The display draws what the model states    | Con — the model's list means nothing until sorted, and whoever sorts has to know how                                                                                                                                                                                                                          |
| D03 | The Fahrtrichtung is not lost              | Pro — carried as a field                                                                                                                                                                                                                                                                                      |
| D04 | One well-defined order                     | Con — the letter cannot order coaches in the same Abschnitt (three in C for ICE 599). Sources without Abschnitte have nothing to sort by until the generic placement has run. A train stands contiguous on the platform, so only two orders exist at all; sorting reconstructs what the provider already knew |

### O05 — Keep Zugspitze first and nothing else

The model as it is.

| ID  | Driver                                     | Assessment                                                        |
| --- | ------------------------------------------ | ----------------------------------------------------------------- |
| D01 | The platform reads the same way every time | Con — mirrored for every train whose Zugspitze points away from A |
| D02 | The display draws what the model states    | Pro — unchanged                                                   |
| D03 | The Fahrtrichtung is not lost              | Pro — the order carries it                                        |
| D04 | One well-defined order                     | Pro — Zugspitze first                                             |

Fine while every Wagenreihung stands on the generic platform; visibly wrong for about half of all
trains as soon as real Abschnitte arrive.
