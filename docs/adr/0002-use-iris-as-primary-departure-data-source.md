# ADR-0002 — Use IRIS as the primary departure data source

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-08

## Context and Problem Statement

The display needs live departures for a given station **and platform**: planned and actual time,
planned and actual platform, destination, via stations, train category and number, cancellations, and
the reason for a delay. Deutsche Bahn shut down its public HAFAS endpoint, and the successor APIs are
unofficial, actively blocked and undocumented, so the source cannot be chosen from documentation — it
has to be measured.

The app runs **locally on the user's own machine**, while the source code is public and other people
are expected to clone and run it. That shapes the requirements: a source must work from an ordinary
private connection, must be usable from a browser app without a server in front of it, and must
tolerate all-day polling by each user individually rather than one central server. Credentials are
acceptable as long as they are **free and obtained per user**: a key that each user registers for
themselves and keeps in a local, untracked configuration file is fine, whereas a paid subscription is
only justified if no usable free source exists at all.

That last clause settles the official route: **the DB API Marketplace offers no free tier** for the
relevant APIs. Since a free source does work (see below), paying for access is not justified, and the
official APIs are out of scope for this decision — for departures and for coach-sequence data alike.

All measurements below were taken on **2026-09-08** from a private German consumer internet connection,
on Windows. Reference stations: Frankfurt(Main)Hbf (EVA 8000105), Köln Hbf (8000207), Bad Vilbel
(8000760, small station).

### How the candidates were tested

The evidence is deliberately reported per option, because it is **not equally strong** for all of them:

| Option | Method | Evidence strength |
|---|---|---|
| IRIS | Own `fetch` script plus `curl`: three stations across `plan`, `fchg` and `station`; message analysis over 4081 message elements; a 15-request rate probe; response headers inspected | Strong — measured directly, repeatedly |
| db-vendo-client | Installed from npm (6.11.2) and executed locally: a script calling `client.departures('8000105', {duration: 30, results: 3})` once per profile. The first run failed at parse time on the machine's Node 20.9.0; repeated under a portable Node 24.20.0, which produced the actual HTTP responses | Strong for "blocked here today"; nothing measured about field coverage |
| db-rest (public instance) | `curl` against the hosted instance, three times over roughly 25 minutes | Strong for availability, nothing else |
| db-rest (self-hosted) | **Not tested.** Rated by inference from the fact that it wraps db-vendo-client | Weak — inference only |
| MOTIS / transitous | `curl` against the public HTTP API (geocode, stoptimes). The client library was **not** installed; the name assumed at the outset (`motis-fptf-client`) does not exist on npm — the real package is `@motis-project/motis-fptf-client` | Moderate for data quality, none for the library |
| DB API Marketplace | One unauthenticated probe, which returned 404/401 as expected | Effectively untested — no credentials were obtained |

## Decision Drivers

| ID | Driver | Why it matters |
|---|---|---|
| D01 | Answers at all today, from a private connection | The DB successor APIs block by IP and client; anything that returns 403/503 in testing is unusable regardless of its feature list |
| D02 | Complete platform data: planned, actual, and the station's platform list | Platform is a configuration input and a displayed field; a station-wide board without per-platform data cannot reproduce a platform display |
| D03 | ZZA-specific detail: via stations, delay causes, cancellations, messages | These fill the destination block and the scrolling line; a source with only time and destination cannot drive this display |
| D04 | Usable from a locally run browser app, with at most a free per-user key | No shared secret in a public repository and no server to operate. A free key each user registers for themselves and stores locally is acceptable; a paid subscription is only acceptable if nothing free works |
| D05 | Headroom for continuous polling | A departure display refreshes all day; a source that throttles after a few dozen requests forces artificial staleness |
| D06 | Longevity and official standing | Undocumented endpoints can vanish without notice; an official API is more durable but comes with registration and quota |

## Considered Options

| Option | D01 | D02 | D03 | D04 | D05 | D06 |
|---|---|---|---|---|---|---|
| **O01** — IRIS (`iris.noncd.db.de/iris-tts`) directly from the browser | Pro | Pro | Pro | Pro | Pro | Con |
| **O02** — db-vendo-client (bahn.de / DB Navigator / RIS profiles) | Con | Undec | Undec | Con | Undec | Undec |
| **O03** — Public db-rest instance (`v6.db.transport.rest`) | Con | Undec | Undec | Pro | Undec | Con |
| **O04** — Self-hosted db-rest | Con | Undec | Undec | Con | Undec | Con |
| **O05** — MOTIS via the public transitous instance | Pro | Con | Con | Pro | Undec | Pro |
| **O06** — DB API Marketplace (RIS::Boards, official, paid) | Undec | Undec | Undec | Con | Undec | Pro |

## Decision Outcome

**Recommendation: O01 — IRIS as the primary source, consumed directly from the browser, with O05
(MOTIS/transitous) documented as the fallback and O06 (RIS::Boards) as the escape hatch if IRIS
closes.**

IRIS was the only candidate that answered every request during testing, and it happens to be the
richest in exactly the fields this display needs — unsurprisingly, since it is the interface behind
DB's own station displays. Three endpoints cover the whole app:

- `GET /iris-tts/timetable/plan/{eva}/{yymmdd}/{hh}` — the planned hour: category, train number,
  operator, planned time, planned platform, line label, and the full via path as a pipe-separated list.
- `GET /iris-tts/timetable/fchg/{eva}` — all current deviations: changed time (`ct`), changed platform
  (`cp`), cancellation status (`cs`), and messages.
- `GET /iris-tts/timetable/station/{name|ds100}` — station resolution by name **or** RL100/DS100 code,
  returning EVA number, DS100, and the station's list of platforms.

The trade-off accepted is **D06**: IRIS is undocumented, carries no service guarantee, and could be
closed or restricted at any time. That is accepted because every alternative failed a driver that
matters more immediately — D01 for the bahn.de-derived options, D02/D03 for MOTIS — and because the
architecture keeps the source behind a provider interface, so replacing it is a contained change
rather than a rewrite.

The one remaining uncertainty was whether the official APIs could compete under a free per-user key.
They cannot: **the Marketplace has no free tier**, so O06 fails D04 on cost, and with a working free
source available a paid subscription is not justified. This also closes the `dbris` route through
db-vendo-client, which failed on missing credentials rather than on blocking — without a free key,
that profile is not reachable either. Most of O06's assessment stays `Undec` because it was never
measured; that is unchanged by this decision, and it is why the option is documented rather than
dismissed. Two other IRIS-specific costs come with the decision: the data is XML, so an
XML parser is a required dependency, and messages carry **no human-readable text**, only numeric
codes, so the project has to maintain its own code→text mapping table for the scrolling line.

**Consequences.**

- No server component is needed for departures: IRIS answers with `Access-Control-Allow-Origin: *`,
  so the browser can call it directly. That keeps the app a static build any user can run locally, and
  nobody has to register anywhere before it works — the app is usable the moment it is cloned.
- `Cache-Control: max-age=8` states the intended freshness. A 15–30 s poll interval is therefore well
  inside intended use, and there is no measured reason to poll more slowly for fear of blocking.
- The provider adapter must combine two endpoints (`plan` + `fchg`) into one view of a departure —
  more mapping work than a single REST call, and the join key is the IRIS stop `id`.
- A message-code table has to be built and maintained; unknown codes must degrade to showing nothing
  rather than a raw number.
- Delay causes are available as codes (`t="d"`), and disruption messages as categories
  (`t="h"`, `cat="Störung"` / `"Information"`) — but the latter have no text at all in this feed, so
  the scrolling line can name a category and not a specific reason.
- **Failure mode to watch:** IRIS starting to answer 403 with a "Request Rejected" HTML body (this is
  what its blocked paths already return), or `fchg` going empty while `plan` still works. Both are
  detectable in the adapter and must surface as "data stale", not as an empty display. If it happens,
  O05 is the documented fallback: it works today and needs no credentials, at the cost of imprecise
  platform data — a station board rather than a platform display.
- Coach-sequence data is **not** solved by this decision. No free source responded during testing, so
  that part of the display must degrade to a defined idle state; it is tracked separately.

## Pros and Cons of the Options

### O01 — IRIS (`iris.noncd.db.de/iris-tts`) directly from the browser

The interface DB's own station infrastructure is fed from. Undocumented, no authentication, XML.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Answers today | Pro — all three stations returned HTTP 200 on `plan`, `fchg` and `station`, in 23–128 ms |
| D02 | Platform data | Pro — planned platform (`pp`) and changed platform (`cp`) per departure; 144 of 581 deviation records at Frankfurt carried a changed platform. `station` returns the platform list, e.g. `22\|23\|24\|1a\|10\|…` |
| D03 | ZZA detail | Pro — via path as `ppth`, delay causes as coded messages (`t="d"`, e.g. `c=43`, `c=51`, `c=48`), cancellations (25 at Frankfurt), 204 records with messages, plus category/number/operator and line label |
| D04 | Local browser use | Pro — `Access-Control-Allow-Origin: *`, no key, no registration; `OPTIONS` preflight answers 200 |
| D05 | Polling headroom | Pro — 15 requests at 1.5 s intervals all returned 200 (53–781 ms), no throttling or blocking observed |
| D06 | Longevity | Con — undocumented internal interface, no terms of use, no guarantee; blocked paths within the same host already answer with a "Request Rejected" page |

Measured gaps: messages carry only `id`, `t`, `ts`, `c`, and for HIM entries `from`/`to`/`cat`/`pr`
— across 4081 messages there was **no free-text attribute**. Station lookup needs an exact RL100 code
(`FF` resolved Frankfurt; an invented `BVB` returned an empty list), so name search is the safer path.

### O02 — db-vendo-client (bahn.de / DB Navigator / RIS profiles)

The maintained community client for DB's successor APIs, hafas-client-compatible, six profiles.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Answers today | Con — every profile failed: `db` and `dbnav` returned `OPS_BLOCKED`, `dbweb` `Forbidden`, `dbris` `401 Invalid client id or secret`, `dbbahnhof` an HTML error page, and `dbregioguide` threw `reqOptions.headers.get is not a function` inside the client |
| D02 | Platform data | Undec — the field exists in its data model, but nothing could be measured through the block |
| D03 | ZZA detail | Undec — same reason; via stations would additionally need a separate trip call per train |
| D04 | Local browser use | Con — a Node client, not browser-safe; the bahn.de endpoints are not CORS-open, so a local proxy would be required, and `dbris` needs Marketplace credentials |
| D05 | Polling headroom | Undec — unmeasurable while blocked; the project's own documentation describes the underlying APIs as much more tightly limited than the old HAFAS one |
| D06 | Longevity | Undec — the client is actively maintained, but it can only be as durable as the endpoints it wraps, which are the ones blocking |

Also relevant: all six profile modules use `import … with { type: 'json' }`, which needs Node ≥ 20.10,
while the package declares `engines: >=18`. On Node 20.9.0 every profile failed to parse before a
single request was made. This is a genuine candidate again the moment the blocking stops — it is the
best-maintained option and its interface is the de-facto standard.

**Important caveat on the D01 rating:** another actively developed display generator credits
db-vendo-client for its live data, so the blocking observed here is not necessarily universal — it may
be specific to this IP, this route, or this point in time, and DB's blocking is known to be applied
haphazardly. The Con therefore means "did not work from the machine this project runs on, on
2026-09-08", not "is permanently unusable". Since the app is meant to run on exactly this kind of
private connection, that distinction does not change the recommendation — but it does mean this option
should be re-probed before it is written off, and it is the natural first candidate if IRIS closes.

### O03 — Public db-rest instance (`v6.db.transport.rest`)

A hosted REST facade over db-vendo-client, no installation, plain JSON.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Answers today | Con — HTTP 503 on all three attempts across roughly 25 minutes, each after about 10 seconds |
| D02 | Platform data | Undec — documented, not observed |
| D03 | ZZA detail | Undec — not observed; via stations would need extra trip requests |
| D04 | Local browser use | Pro — plain JSON over HTTPS, CORS-open, no credentials; this is its main attraction |
| D05 | Polling headroom | Undec — a shared public instance would in any case be a courtesy resource, not a display feed |
| D06 | Longevity | Con — it depends on the same blocked upstream APIs, which is the likely cause of the 503s |

### O04 — Self-hosted db-rest

The same facade, run locally, to remove the shared-instance dependency.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Answers today | Con — it wraps db-vendo-client, so it inherits O02's blocking; self-hosting fixes availability, not access |
| D02 | Platform data | Undec — as O02 |
| D03 | ZZA detail | Undec — as O02 |
| D04 | Local browser use | Con — requires every user to run a server next to the app, which contradicts a static local build from a public repository |
| D05 | Polling headroom | Undec — adds a caching layer, which would help if the upstream worked |
| D06 | Longevity | Con — same upstream exposure, plus an operational burden per user |

### O05 — MOTIS via the public transitous instance

An open routing server on aggregated GTFS/GTFS-RT data (DELFI for Germany), with an FPTF-compatible
client available.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Answers today | Pro — geocoding and `stoptimes` both returned HTTP 200 |
| D02 | Platform data | Con — station resolution at Frankfurt Hbf returned tram platforms among the results, and platform information appeared as free-form text such as `Strab VPLDR` rather than a platform number; a platform filter cannot be built reliably on that |
| D03 | ZZA detail | Con — GTFS-grade content: no delay-cause codes, no DB-style disruption categories, no coach data |
| D04 | Local browser use | Pro — public HTTPS API, no credentials |
| D05 | Polling headroom | Undec — a shared community instance; polite use is expected but no limit was measured |
| D06 | Longevity | Pro — open project, open data, documented API; the most durable of the options |

The designated fallback: if IRIS closes, this keeps the app working as a station board with degraded
platform precision, without requiring credentials.

### O06 — DB API Marketplace (RIS::Boards, official, free per-user key)

DB's official developer offering, with station-board and formation APIs behind registration.

| ID | Driver | Assessment |
|---|---|---|
| D01 | Answers today | Undec — effectively untested: no credentials were obtained, and a single unauthenticated probe returned 404/401 as expected |
| D02 | Platform data | Undec — advertised, unverified |
| D03 | ZZA detail | Undec — unverified; this is also the only known remaining route to coach-sequence data |
| D04 | Local browser use | Con — **there is no free tier.** A free per-user key would have been acceptable; a paid subscription is not, while a working free source exists. On top of the cost, every user would have to register before the app worked at all |
| D05 | Polling headroom | Undec — quota-based, and never measured |
| D06 | Longevity | Pro — the only option with terms of use and a support path |

Ruled out on cost, not on capability. It remains the only known route to coach-sequence data and the
option to revisit if every free source stops working — at that point paying would be justified, and
this ADR would be superseded rather than quietly reinterpreted.

Note that db-vendo-client's `dbris` profile failed with `401 Invalid client id or secret`, a
credentials error rather than a block. It runs on Marketplace credentials, so the absence of a free
tier closes that path too.
