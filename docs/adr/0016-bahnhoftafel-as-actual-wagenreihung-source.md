# ADR-0016 — Tagesaktuelle Wagenreihungen come from the bahnhoftafel.de API

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-11-26

## Context and Problem Statement

Wagenreihungen have their own provider port, configured separately from the departure provider
(ADR-0015). The only source behind it so far is a local copy of fernbahn.de's hand-curated
directory. That copy gives only planmäßige Wagenreihungen and no Bahnsteigabschnitte, so the
Wagenstandsanzeiger places every train on a generic 400 m platform with six equal Abschnitte and the
Zugspitze at A. On 2026-09-08 no free real-time source worked:

- DB's IRIS answers `wzr` with "Request Rejected" and `wingdef` with 404.
- The bahn.de vehicle-sequence endpoint answers 403 `OPS_BLOCKED`.
- `ist-wr.noncd.db.de` no longer resolves.
- The DB API Marketplace has no free tier.

A new candidate has turned up: the **bahnhoftafel.de developer API** (`https://developer.bahnhoftafel.de/v1`).

- It is run privately by "Thyrakles" and is not an offering of DB.
- Keys are free and per user. They are created in a portal that uses a Discord login, look like
  `bt_<app-id>_<secret>`, and are sent as `Authorization: Bearer …`.
- Its documentation says the API sends **no CORS headers**, and keys belong on a server.
- Limits are a token bucket per key: the `standard` bucket holds 30 requests and refills 60 per
  minute. The API answers 429 with `Retry-After` when the bucket is empty, and locks a key out for
  10 minutes after 300 failed requests in 10 minutes.
- There is no SLA and "no claim to permanent availability". Within `v1`, only fields and endpoints
  are added.
- The terms forbid presenting content as coming from DB, or passing it off as one's own without
  pointing to bahnhoftafel.de. The rule that a display must not look like an official railway display
  covers only their own boards embedded on other sites, not the API.

Two of its endpoints matter here:

- `GET /v1/formation?station=<EVA>&category=<ICE>&number=<599>&departure=<ISO 8601 planned departure>`
  returns one Wagenreihung:
  - `platform`;
  - `direction` (`0` = the Zugspitze points to Abschnitt A, `100` = to the other end, `null` =
    unknown);
  - `sectors[]` with `name`, `start` and `end` in percent of the platform length;
  - `groups[]`, each with `name`, `number`, `destination`, `series` and `carriages[]`. Each carriage has
    `number`, `class` (`1`, `2`, `12` = both, `0` = none), `sector`, `position.start`/`end` in percent,
    `closed` and `features[]`.
- `GET /v1/stations/{eva}/platforms/{platform}` returns one platform's trains together with each
  train's coach sequence. The field names there differ, e.g. `start_percent` and `class: "1/2"`.

**Measurements**, taken on 2026-11-26 between 16:10 and 16:20 from a private German consumer
connection: three departure boards and fifteen Wagenreihung requests at Frankfurt(Main)Hbf (8000105)
and Köln Hbf (8000207).

| Question       | Result                                                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real time?     | ICE 599 had changed platform from 7 to 6, ICE 12 from 2 to 1a. Both answered for the **new** platform, with its own Abschnitte. Groups carry real trainset numbers (`ICE9043`, `ICE104`, `ICE8039`). No field states actual versus scheduled |
| Coverage       | ICE 1, 3, 4 and T, TGV, IC2 double-deck (`double_deck`, `locomotive`) and RE 50 (from the platform endpoint) answered. FLX 1325 and 1327 and ICE 2835 answered `502 upstream_unavailable` instead                                            |
| Coach order    | Always Zugspitze first. With `direction: 0` the first coach stands at 6–8 % (the A end); with `100` at 80–88 %                                                                                                                               |
| Geometry       | Abschnitte differ in size. On Frankfurt Hbf platform 9, D covers 7.5 % and C 22.8 %. Every coach had an Abschnitt and a position                                                                                                             |
| Coupled trains | All samples had exactly one group, including ICE 653, which the departure board reports with `wings` to ICE 2819. A Wagenreihung made of two groups was not observed                                                                         |
| Latency        | 0.5–3.5 s per Wagenreihung; about 2 s per departure board; 4.2 s for the platform endpoint                                                                                                                                                   |
| Headers        | `cache-control: no-store`, `x-ratelimit-limit: 30`, `x-ratelimit-remaining`, `x-ratelimit-reset-after`; no `Access-Control-Allow-Origin`                                                                                                     |

The question this record settles: which source delivers tagesaktuelle Wagenreihungen to the
Wagenreihung port, and how it is mapped onto the domain model.

## Decision Drivers

| ID  | Driver                                           | Why it matters                                                                                                                          |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Tagesaktuelle Wagenreihung                       | A real Wagenstandsanzeiger shows today's train; a planmäßige Wagenreihung is wrong whenever the train is changed, reversed or shortened |
| D02 | Placed against the platform it actually stops at | Without real Abschnitte, travellers' positions are only plausible; a platform change moves the whole train                              |
| D03 | Fits the separate Wagenreihung port              | ADR-0015 keeps departures and Wagenreihungen apart; a source must answer per train, without the departure provider knowing about it     |
| D04 | Free, per-user access                            | The project is public and run locally by each user. A free key per user is acceptable, a paid subscription is not                       |
| D05 | Load and latency within one display's means      | The view model asks once per departure and poll. That must stay within the source's limit and never hold up the board                   |
| D06 | Longevity and standing                           | A source that disappears leaves the Wagenstandsanzeiger idle; how likely that is should be known up front                               |

## Considered Options

| Option                                                                | D01   | D02 | D03 | D04 | D05   | D06 |
| --------------------------------------------------------------------- | ----- | --- | --- | --- | ----- | --- |
| **O01** — bahnhoftafel.de `/v1/formation`, one request per train      | Pro   | Pro | Pro | Pro | Pro   | Con |
| **O02** — bahnhoftafel.de platform endpoint, one request per platform | Pro   | Pro | Con | Pro | Undec | Con |
| **O03** — Keep only the local fernbahn.de copy                        | Con   | Con | Pro | Pro | Pro   | Con |
| **O04** — DB API Marketplace (official coach-sequence API)            | Undec | Pro | Pro | Con | Undec | Pro |
| **O05** — bahn.de vehicle-sequence endpoint                           | Pro   | Pro | Pro | Con | Undec | Con |

## Decision Outcome

**Recommendation: O01.** A new Wagenreihung provider, `bahnhoftafel`, asks
`/v1/formation` once per departure. It sits next to `none` and `fernbahn-local` and is chosen in the
configuration on its own. Departures stay with IRIS. bahnhoftafel's departures come from IRIS too and
would add nothing but a second dependency.

O01 is the only option that meets D01 and D02 for free. The measured platform changes show that the
answer follows the platform the train actually uses. It fits the existing port without changing
ADR-0015's split.

How the answer is mapped, so that the domain model carries what the source states:

- The Wagenreihung counts as **tagesaktuell** (`accuracy: 'actual'`). The source does not say so
  itself. The evidence is that the answer follows platform changes and that groups carry trainset
  numbers.
- The coaches come in platform order from the end of Abschnitt A, with the Fahrtrichtung beside them
  (ADR-0018). The provider sorts them by `position.start` instead of trusting the list order, and maps
  `direction` `0` to `'start'`, `100` to `'end'`, and `null` to absent.
- Each coach takes its `sector` as its Bahnsteigabschnitt. Its `lengthMetres` is derived from the
  percentage width against a nominal platform length. The Abschnitte themselves, with their real
  extent, are not modelled yet; that is a separate decision.
- Classes `1`, `2`, `12` and `0` become `first`, `second`, `mixed` and `none`. Features map as follows:
  `bike` to `bicycles`, `bistro`, `wheelchair`, `family_zone` to `familyZone`, `quiet_zone` to
  `quietZone`, `locomotive`, and `power_car` to `powerCar`. `first_class` is dropped because the class
  carries it. `comfort`, `infant_cabin`, `double_deck` and `closed` are dropped until a design draws
  them.
- `FormationRequest` gains `station: { eva, name }` in place of the station name, and the current
  platform. The provider uses the EVA; fernbahn keeps matching by name.
- The provider caches its answers itself, as ADR-0015 foresees. An answer holds about 15 minutes, and
  about 2 minutes from 30 minutes before departure, when late changes are made. A platform change
  makes a new request and so bypasses the cache. On 429 it waits for `Retry-After` and answers `null`
  meanwhile.
- `404 formation_not_found` and `502 upstream_unavailable` mean "no Wagenreihung" (`null`), the normal
  idle state. `401`, `403` and an unreachable proxy are real errors and show in the diagnostics.
- The display names its sources, bahnhoftafel.de among them, in a shared block that each design places
  in its bottom margin, as the terms require.

Accepted trade-off: D06. The source is one private operator's project without an SLA, behind a
Discord-gated key, and can block a key or close at any time. That is acceptable because the
Wagenreihung is optional by design: without it, the Wagenstandsanzeiger shows its idle state and the
departures are unaffected. The fernbahn.de copy, which has the same private standing, has the same
risk.

**Consequences.**

- Each user needs a bahnhoftafel key and a local proxy that attaches it (decided separately).
- Load has to be watched. The view model asks once per departure and poll. A station overview with 20
  entries, at the 60 s poll, would ask 20 times a minute without the provider's cache, against a
  bucket of 30 that refills 60 per minute. The cache keeps this to a fraction.
- It stops working when the diagnostics report 401 or 403, the key is locked, or every answer turns
  into 502. The fallback is `fernbahn-local` for planmäßige Wagenreihungen, then `none`.
- If DB's coach-sequence endpoint reopens, O05 becomes the escape hatch. So does O04, should a free
  tier appear.

## Pros and Cons of the Options

### O01 — bahnhoftafel.de `/v1/formation`, one request per train

A Wagenreihung provider that asks for one train by EVA, category, number and planned departure, and
maps the answer onto `TrainFormation`.

| ID  | Driver                                           | Assessment                                                                                                     |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| D01 | Tagesaktuelle Wagenreihung                       | Pro — follows platform changes and names trainsets, though it does not say so in a field                       |
| D02 | Placed against the platform it actually stops at | Pro — Abschnitt and percentage position per coach, on the actual platform                                      |
| D03 | Fits the separate Wagenreihung port              | Pro — one train in, one Wagenreihung out; needs the station's EVA, which the request gains                     |
| D04 | Free, per-user access                            | Pro — free key per user; needs a local proxy because there are no CORS headers                                 |
| D05 | Load and latency within one display's means      | Pro — 0.5–3.5 s per request, outside the board's own query; 60 requests/min suffices with the provider's cache |
| D06 | Longevity and standing                           | Con — private operator, no SLA, Discord-gated keys                                                             |

### O02 — bahnhoftafel.de platform endpoint, one request per platform

`/v1/stations/{eva}/platforms/{platform}` returns the trains at a platform with their coach
sequences, so one request serves every train on a platform display.

| ID  | Driver                                           | Assessment                                                                                                                                                                               |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Tagesaktuelle Wagenreihung                       | Pro — same data as O01                                                                                                                                                                   |
| D02 | Placed against the platform it actually stops at | Pro — same data as O01                                                                                                                                                                   |
| D03 | Fits the separate Wagenreihung port              | Con — the answer is per platform, not per train. A station overview needs one request per platform, and matching its trains to IRIS departures adds a second join next to the port's own |
| D04 | Free, per-user access                            | Pro — same key                                                                                                                                                                           |
| D05 | Load and latency within one display's means      | Undec — fewer requests on a platform display, but the slowest endpoint measured (4.2 s), and its cost for a station overview grows with the number of platforms                          |
| D06 | Longevity and standing                           | Con — as O01                                                                                                                                                                             |

Worth revisiting if load from O01 turns out to be a problem on platform displays.

### O03 — Keep only the local fernbahn.de copy

The existing provider: a hand-curated directory of planmäßige Wagenreihungen, saved locally.

| ID  | Driver                                           | Assessment                                                                    |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| D01 | Tagesaktuelle Wagenreihung                       | Con — planmäßig only, per timetable period                                    |
| D02 | Placed against the platform it actually stops at | Con — no Abschnitte; every train stands on the generic platform               |
| D03 | Fits the separate Wagenreihung port              | Pro — already implemented against it                                          |
| D04 | Free, per-user access                            | Pro — a saved page, no key                                                    |
| D05 | Load and latency within one display's means      | Pro — read once, answered from memory                                         |
| D06 | Longevity and standing                           | Con — private, hand-curated, and its page structure can change without notice |

It stays available as the fallback, and for trains that bahnhoftafel does not cover.

### O04 — DB API Marketplace (official coach-sequence API)

DB's official API, behind a Marketplace subscription.

| ID  | Driver                                           | Assessment                                       |
| --- | ------------------------------------------------ | ------------------------------------------------ |
| D01 | Tagesaktuelle Wagenreihung                       | Undec — not tested; no credentials were obtained |
| D02 | Placed against the platform it actually stops at | Pro — the official data carries Abschnitte       |
| D03 | Fits the separate Wagenreihung port              | Pro — a per-train lookup                         |
| D04 | Free, per-user access                            | Con — no free tier                               |
| D05 | Load and latency within one display's means      | Undec — not measured                             |
| D06 | Longevity and standing                           | Pro — official and contracted                    |

### O05 — bahn.de vehicle-sequence endpoint

The endpoint behind bahn.de's own Wagenreihung view.

| ID  | Driver                                           | Assessment                                                                      |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| D01 | Tagesaktuelle Wagenreihung                       | Pro — the source of bahn.de's own Wagenreihung view                             |
| D02 | Placed against the platform it actually stops at | Pro — carries Abschnitte                                                        |
| D03 | Fits the separate Wagenreihung port              | Pro — a per-train lookup                                                        |
| D04 | Free, per-user access                            | Con — answered 403 `OPS_BLOCKED` on 2026-09-08; unofficial and actively blocked |
| D05 | Load and latency within one display's means      | Undec — never answered                                                          |
| D06 | Longevity and standing                           | Con — undocumented and blocked                                                  |
