# ZZA Display

A recreation of German railway platform departure displays (Zugzielanzeiger). These terms name what
such a display shows and where that content comes from.

## Language

### What a display says about a train

**Message**:
A text the data source delivers about a train, such as a delay cause, a disruption report or a
quality message about the train itself.
_Avoid_: hint, notice (for source texts)

**Quality message**:
A message from the source about the train's own quality: its coach order, missing coaches,
bicycles, catering, accessibility, occupancy, a bus replacing it.
_Avoid_: quality notice

**Notice**:
A statement a display derives from the train's own state rather than receiving it from the source:
it is cancelled, it is a replacement, it splits at a stop, it leaves from another platform today, its
route differs from the timetable.
_Avoid_: hint, message (for derived statements)

**Running line**:
The field of a display in which messages and notices run as scrolling text, one after another.
_Avoid_: ticker, marquee, hint line, Laufschrift
