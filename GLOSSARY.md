# ZZA-Display

A recreation of the German railway (DB) platform departure display (Zugzielanzeiger, ZZA). These are
the domain terms the project uses. The German railway term is the canonical one in conversation and
documentation; _Code_ names the one English word that stands for it in identifiers, so each term has
exactly one name in the code.

## Coach sequence

**Wagenreihung**:
The order of the coaches of one train as they stand along the platform, from the end of
Bahnsteigabschnitt A, with each coach's number, class and features.
_Code_: `formation` (`TrainFormation`)

**Wagenstandsanzeiger**:
The part of the display that shows a train's Wagenreihung against the Bahnsteigabschnitte.
_Code_: `formationDisplay` (`TrainFormationDisplay`)

**Bahnsteigabschnitt** (Abschnitt):
A lettered stretch of a platform (A, B, C, …) that travellers use to find where their coach stops.
_Code_: `section`

**Zugspitze**:
The end of the train that leads in its current direction of travel.
_Code_: `front`

**Fahrtrichtung**:
The end of the platform the Zugspitze points to: the end of Bahnsteigabschnitt A, or the other one.
Where a Wagenreihung is placed without a known platform, the Zugspitze stands at the end of A.
_Code_: `directionOfTravel`

**Richtungswechsel**:
A stop where the train reverses, so that its former rear end becomes the Zugspitze.
_Code_: `reversal`

**Planmäßige Wagenreihung**:
The Wagenreihung a train is timetabled to run with over a period, not necessarily the one it runs
with today.
_Code_: `scheduled` (as the formation's accuracy)

**Tagesaktuelle Wagenreihung**:
The Wagenreihung of the train actually running today.
_Code_: `actual` (as the formation's accuracy)
