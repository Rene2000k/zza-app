# zza-display

A recreation of a German railway departure display — the *Zugzielanzeiger* (ZZA) found on DB
platforms — as a React app, driven by real-time departure data.

## Idea

A real platform display is not one picture. It is a set of independent elements — the clock, the
destination, the train number, the coach-position diagram, the scrolling message line, the platform
number — arranged differently on every generation of hardware. This project mirrors that: the display
is assembled from **swappable components**, and a **design** decides which of them appear, where, at
what size, and in what visual style.

That separation is the point of the project. Adding another display generation should mean adding a
design, not touching the data layer.

The first design being built is **V3 5X2**. Others are meant to follow.

A display instance is configured by at least **station** and **platform**, so it can reproduce what a
specific platform's own display would show.

## Status

Early, but the layers are in place: provider, domain model, clock port, view model, the shared display
blocks and a design registry. Departures come from IRIS
([ADR-0002](docs/adr/0002-use-iris-as-primary-departure-data-source.md)) or from fixtures.

The only design so far is `debug`, and it is deliberately ugly — its job is to prove that the core does
not know its designs ([ADR-0009](docs/adr/0009-shared-blocks-own-mechanism-designs-choose-wording.md)).
The replica of V3 5X2 comes next. Coach-sequence data has no working free source, so that part of a
display degrades to a defined idle state.

## Getting started

Requires **Node 24** (see `.nvmrc`; anything below 20.19 cannot run the tooling).

```sh
npm install
npm run dev      # dev server
npm test         # unit and component tests
npm run lint     # ESLint, including the clock-port rule from ADR-0004
npm run build    # type-check and production build
```

## Development pages

Two pages sit next to the display itself:

| Path | Shows |
|---|---|
| `/gallery` | every shared display block on its own, in the cases that matter |
| `/preview` | any design against any named scenario: cancellation, platform change, long name, stale data, no data at all |

## Configuring a display

A display is configured entirely through the URL query, so a configured display is a shareable link:

```
http://localhost:5173/?station=8000105&platform=9&provider=mock
```

| Parameter | Meaning | Default |
|---|---|---|
| `station` | EVA number (IBNR) of the station, e.g. `8000105` | required |
| `platform` | Platform label, e.g. `9` or `1a`. Omit for the whole station | all platforms |
| `design` | Design id — currently only `debug` | `debug` |
| `provider` | Data source id: `mock` (fixtures) or `iris` (live) | `mock` |
| `refreshSeconds` | Poll interval, 10–600 | `30` |
| `horizonMinutes` | How far ahead the board looks, 5–360 | `120` |
| `simulatedTime` | Freeze the clock at this ISO 8601 instant (demo mode) | live time |
| `timeFactor` | Run the clock faster than real time, e.g. `60` | `1` |

Invalid values are reported on screen rather than silently replaced — a display showing the wrong
station is worse than one showing an error.

## Repository

- [AGENTS.md](AGENTS.md) — project conventions: architecture rules, branch and commit strategy,
  React practices, and when an ADR is required.
- [docs/adr/](docs/adr/README.md) — architecture decision records: what was decided, which options
  were weighed, and why the others lost.
- `src/domain/` — the display's own model. No API type ever reaches a component.
- `src/providers/` — one adapter per data source, chosen through a registry.
- `src/platform/clock.ts` — the only place allowed to read the system clock.

## Tech stack

Vite · React 19 · TypeScript (strict) · TanStack Query · Zod · CSS with custom properties · Vitest

## License

[Apache-2.0](LICENSE)
