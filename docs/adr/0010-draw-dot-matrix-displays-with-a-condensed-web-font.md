# ADR-0010 — Draw dot-matrix displays with a free condensed web font, not a reproduced matrix

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-12

## Context and Problem Statement

The first display this project reproduces is a German railway departure board built from
5 × 2 physical modules.

- One module is **96 × 64 dots**; the display has **480 × 128 dots** of active area, with a
  1-dot dark seam at each module's right edge and an 11-dot dark gap between the two module
  rows.
- The dots are **not square**: 5.2 px wide and 6.0 px tall in the reference rendering, so a
  module is physically 1.31 times wider than tall. A Deutsche Bahn infographic of the same
  display gives 1.28 independently, and both agree on an overall active-area ratio of 3.02 : 1.
- The picture is **two colours only**: lit blue `#0c30a8` and lit white `#eeeeee` on unlit
  `#0b0a45`. Emphasis is inversion, never colour.
- Text appears at six cap heights — **7, 10, 14, 17, 21 and 42 dots** — with stroke widths of
  1, 1, 2, 2, 3 and 6 dots.

Every glyph on the original is therefore a bitmap snapped to that grid. The question is how to
render text in the replica: reproduce the matrix, or draw with an ordinary outline font and
accept a result that is sharper than the original.

Two constraints bound the answer. The repository is public and third parties are meant to use
the code, so no licensed typeface may be used and no third-party font file may be vendored into
the tree. And the community pixel fonts built for these displays (`lcdzza-10px`, `DB_ZZA_10`)
carry no discernible licence, which rules them out for the same reason.

### What the measurements say about the typeface

Converting the dot measurements into physical proportions — multiplying horizontal counts by
5.2 and vertical ones by 6.0 — gives two figures that constrain any replacement.

**Weight.** Stroke width divided by cap height is **0.124** at cap 14, 21 and 42 alike. That is
a Regular weight, not a bold one. The smaller sizes fall to 0.102 (cap 17) and 0.087 (cap 10)
only because one dot is the thinnest stroke the hardware can draw.

**Width.** Advance width divided by cap height, against three proprietary faces measured from
their own font files on the same day purely as yardsticks — they are not candidates:

| Glyph / group   | Original (measured)                 | Arial | Arial Narrow | Tahoma |
| --------------- | ----------------------------------- | ----- | ------------ | ------ |
| capital `O`     | 0.78                                | 1.086 | 0.892        | 0.973  |
| digits          | 0.64 (at cap 17) … 0.74 (at cap 14) | 0.776 | 0.637        | 0.751  |
| lowercase `a`   | 0.69                                | 0.776 | 0.637        | 0.722  |
| lowercase `r`   | 0.50                                | 0.465 | 0.381        | 0.496  |
| lowercase, mean | —                                   | 0.683 | 0.561        | 0.672  |
| capitals, mean  | —                                   | 0.946 | 0.776        | 0.836  |

The original's **wide** glyphs run at 70–85 % of normal-grotesque width: capital `O` at 0.78 is
narrower than Arial Narrow's 0.892, and the digits straddle Arial Narrow's 0.637. Its **narrow**
glyphs are relatively _wider_ than a normal face — `r` at 0.50 exceeds Arial's 0.465 — because a
dot grid cannot draw a letter thinner than its minimum cell. The letterform class is therefore
clearly **condensed**, but no single ratio reproduces the original, because a bitmap face
quantised to a 96 × 64 grid is not a linearly scaled outline face. Individual letters scatter by
roughly ±10 %, and the six cap heights are not integer multiples of one another, so the original
is in all likelihood several hand-fitted bitmap faces rather than one scaled design.

That scatter is what makes the acceptance criterion a fitting test rather than a number: the
replacement is right when the measured field widths hold, not when one ratio matches.

## Decision Drivers

| ID  | Driver                                                                        | Why it matters                                                                                                          |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| D01 | Licence permits use and redistribution in a public repository                 | The repository is public and meant to be usable by third parties; a licence problem makes the project undistributable   |
| D02 | No third-party font file in the repository                                    | Standing constraint of this project: fonts arrive as a declared dependency, not as vendored binaries                    |
| D03 | Condensed proportions and a Regular stroke weight, per the measurements above | The layout is dimensioned from those measurements; a face of the wrong class shifts every field and forces a re-measure |
| D04 | Works offline with no network fetch                                           | The app runs as a kiosk display on the user's own machine; a webfont CDN is a runtime dependency that can fail          |
| D05 | Stable across machines                                                        | The same build must lay out identically on the developer's machine and on the target display                            |
| D06 | Effort proportionate to a recognisable homage, not a pixel-exact copy         | The agreed fidelity target is a recognisable reproduction with freedom in glyph rendering                               |
| D07 | Full German coverage incl. umlauts and ß, plus figures                        | Station names and train numbers demand it                                                                               |

## Considered Options

| Option                                                                                 | D01   | D02 | D03   | D04 | D05 | D06 | D07 |
| -------------------------------------------------------------------------------------- | ----- | --- | ----- | --- | --- | --- | --- |
| **O01** — A free condensed grotesque as an npm package, starting with Roboto Condensed | Pro   | Pro | Pro   | Pro | Pro | Pro | Pro |
| **O02** — Own bitmap font traced from the reference matrix                             | Pro   | Pro | Pro   | Pro | Pro | Con | Con |
| **O03** — Existing free pixel font                                                     | Undec | Pro | Con   | Pro | Pro | Pro | Con |
| **O04** — Normal-width free grotesque, squeezed by a horizontal transform              | Pro   | Pro | Undec | Pro | Pro | Pro | Pro |
| **O05** — Generic `sans-serif` system stack                                            | Pro   | Pro | Con   | Pro | Con | Pro | Pro |

Ratings: **Pro** (satisfies the driver), **Con** (violates it), **Undec** (unclear or not
measured — explained in the per-option table).

## Decision Outcome

**O01 is chosen. Displays are drawn with a free condensed grotesque at Regular weight,
installed as an npm package and self-hosted from the build; the dot matrix is not reproduced.**
The family is **Roboto Condensed**, pulled in as `@fontsource/roboto-condensed` (Apache-2.0):
it is in the right class, its licence permits redistribution, and it carries Latin Extended, so
German needs no fallback. Type is specified by **cap height**, never by `font-size`, so the
layout survives a change of family.

Its exact advance ratios were **not verified when this was decided** — the font is not
installed on the development machine and no network was used — so the family carries one
explicit acceptance test, to be run when it is first installed: set the six cap heights from
the layout, render the longest station names and a full via line, and check that they occupy
the measured field widths without the text-squeezing block having to act on ordinary names. If
Roboto Condensed comes out too wide, the substitutes in the same class and licence family are
Fira Sans Condensed, Archivo Narrow, Barlow Condensed and IBM Plex Sans Condensed; swapping
between them changes one declaration and no position.

The module seams and the gap between the module rows **are** drawn even though the dot grid is
not. They are physical features visible on every photograph of the real hardware, and they are
what makes the surface read as a display assembled from 5 × 2 modules rather than as one
rectangle.

**Accepted trade-off: D06 is bought at the price of the original's most characteristic quality.**
A display with an effective resolution of 480 × 128 dots looks soft and coarse; outline text at
the same size looks sharp. The replica will therefore read as _cleaner_ than the hardware it
copies. This is accepted deliberately. Reproducing the matrix means either a hand-drawn bitmap
font (O02 — a full German character set at six cap heights, of which the reference imagery
supplies only the glyphs of its own sample text) or a dot mask laid over outline text, which
does not snap glyphs to the grid and so buys coarseness without buying accuracy.

**Consequences.** Layout work becomes ordinary CSS: fields are positioned in canvas pixels
converted from the measured dot grid at 2.625 px per dot horizontally and 3 px vertically, and
type is specified by **cap height**, which is measurable on the original and independent of the
family — so a change of family does not invalidate the layout. Further designs for other display
generations cost no new font work as long as they are outline-rendered too. What becomes hard is
a later change of mind: moving to a real bitmap matrix would re-open every size and position,
because a bitmap font cannot be scaled to an arbitrary cap height.

The failure mode is visible rather than silent — if the family's metrics are wrong, station
names overflow their fields or leave conspicuous gaps at the sizes given in the layout. The
fallback is O04: the same layout with a normal-width free grotesque squeezed horizontally to the
measured proportion, which keeps every position and costs only glyph quality. Should a
licensable reproduction of the original face ever appear, this ADR is superseded rather than
edited.

## Pros and Cons of the Options

### O01 — A free condensed grotesque as an npm package, starting with Roboto Condensed

A condensed neo-grotesque under a permissive licence, installed through npm and bundled by Vite,
so the font files live in `node_modules` and in the build output, never in the repository.

| ID  | Driver                 | Assessment                                                                                                                                                                                       |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D01 | Licence                | Pro — Roboto Condensed is Apache-2.0; every named substitute is OFL                                                                                                                              |
| D02 | No vendored font file  | Pro — a declared dependency, resolved at install time                                                                                                                                            |
| D03 | Proportions and weight | Pro — condensed is the measured class, and Regular is the measured weight (stroke/cap 0.124). The exact advance ratios are unverified here and are covered by the acceptance test in the outcome |
| D04 | Offline                | Pro — self-hosted through the bundler, no request at runtime                                                                                                                                     |
| D05 | Stable across machines | Pro — the exact file is pinned by the lockfile                                                                                                                                                   |
| D06 | Effort                 | Pro — one dependency, no glyph work                                                                                                                                                              |
| D07 | Coverage               | Pro — Latin Extended covers German fully                                                                                                                                                         |

The risk concentrated in this option is D03: "condensed" spans a wide range, and the original's
own letters scatter by ±10 %, so no family will match every glyph. That is why the criterion is
the layout fitting, not a ratio.

### O02 — Own bitmap font traced from the reference matrix

Trace the glyphs out of the reference dot matrix — which this project has already extracted as a
480 × 128 grid — and draw the missing ones in the same style, at each of the six cap heights.

| ID  | Driver                 | Assessment                                                                                                                                                                                                                                   |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Licence                | Pro — own work, no third-party rights involved                                                                                                                                                                                               |
| D02 | No vendored font file  | Pro — the file would be the project's own                                                                                                                                                                                                    |
| D03 | Proportions and weight | Pro — by construction, this _is_ the original's metric                                                                                                                                                                                       |
| D04 | Offline                | Pro                                                                                                                                                                                                                                          |
| D05 | Stable across machines | Pro                                                                                                                                                                                                                                          |
| D06 | Effort                 | Con — the reference imagery contains only the glyphs of its sample text, so a full German set would be drawn by hand; and because 7/10/14/17/21/42 are not integer multiples of one another, the sizes cannot all be derived from one master |
| D07 | Coverage               | Con — coverage is exactly what has to be drawn, and every missing character is a visible gap until it is                                                                                                                                     |

This option would produce the most faithful result and is the right one if the fidelity target
ever moves from "recognisable" to "pixel-exact". It is rejected on effort, not on quality.

### O03 — Existing free pixel font

Use a ready-made pixel or matrix font published under a free licence and adapt the layout to its
metrics.

| ID  | Driver                 | Assessment                                                                                                                                                                                                    |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Licence                | Undec — the fonts built specifically for these displays (`lcdzza-10px`, `DB_ZZA_10`) carry no discernible licence and are unusable here; generic free pixel fonts are usable but reproduce different hardware |
| D02 | No vendored font file  | Pro — available as packages                                                                                                                                                                                   |
| D03 | Proportions and weight | Con — a generic pixel font matches neither the condensed proportions nor the six measured cap heights, so the layout would be re-derived from the font instead of from the original                           |
| D04 | Offline                | Pro                                                                                                                                                                                                           |
| D05 | Stable across machines | Pro                                                                                                                                                                                                           |
| D06 | Effort                 | Pro — no glyph work                                                                                                                                                                                           |
| D07 | Coverage               | Con — pixel fonts frequently omit ß and the umlauts, or fake them by stacking dots                                                                                                                            |

It buys the coarse look without buying the original's proportions, which is the wrong half of
the trade.

### O04 — Normal-width free grotesque, squeezed by a horizontal transform

Take a normal-width free grotesque — Public Sans is the obvious candidate, because the reference
web page itself renders with it — and produce the condensed proportions with a horizontal scale
of roughly 0.8.

| ID  | Driver                 | Assessment                                                                                                                                                                                                                                                                         |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Licence                | Pro — OFL                                                                                                                                                                                                                                                                          |
| D02 | No vendored font file  | Pro — available as a Fontsource package                                                                                                                                                                                                                                            |
| D03 | Proportions and weight | Undec — the proportions can be hit exactly, but squeezing thins the vertical stems by the same factor while leaving the horizontals untouched, introducing a stroke contrast the original does not have; at a 0.8 squeeze the measured stem/cap of 0.124 would fall to about 0.099 |
| D04 | Offline                | Pro                                                                                                                                                                                                                                                                                |
| D05 | Stable across machines | Pro                                                                                                                                                                                                                                                                                |
| D06 | Effort                 | Pro — a transform, no glyph work                                                                                                                                                                                                                                                   |
| D07 | Coverage               | Pro                                                                                                                                                                                                                                                                                |

Kept as the named fallback: if no condensed family fits, this reaches the measured proportions
without touching a single position.

### O05 — Generic `sans-serif` system stack

Name no family and let each machine substitute its default sans.

| ID  | Driver                 | Assessment                                                                                                                         |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Licence                | Pro — nothing is shipped                                                                                                           |
| D02 | No vendored font file  | Pro                                                                                                                                |
| D03 | Proportions and weight | Con — normal width everywhere; Arial's capital `O` at 1.086 is 39 % wider than the measured 0.78                                   |
| D04 | Offline                | Pro                                                                                                                                |
| D05 | Stable across machines | Con — the substituted face differs between Windows, Linux and the target display device, so one build lays out differently on each |
| D06 | Effort                 | Pro — no work at all                                                                                                               |
| D07 | Coverage               | Pro                                                                                                                                |

D05 alone disqualifies it: a replica whose field widths depend on the operating system is not a
replica.
