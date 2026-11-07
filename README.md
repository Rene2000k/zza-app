# zza-display

A recreation of a German railway departure display, the _Zugzielanzeiger_ (ZZA) found on Deutsche
Bahn platforms, running in the browser and fed with real-time departure data.

Pick a station and a platform, and the app shows what that platform's display would show right now:
the next trains, their destinations and stops, delays, cancellations, platform changes and the
scrolling message line. Run it full screen on a spare monitor or a Raspberry Pi and you have a
platform display at home.

## Quick start

You need **Node 24** (see `.nvmrc`).

```sh
npm install
npm run dev
```

Open <http://localhost:5173/>. Without a configuration you land on the **setup page**: enter the
station's EVA number (it is checked against the data source), choose a platform, a design and a data
source, and open the display. To see something
straight away, use Frankfurt (Main) Hbf, platform 9, with live data:

<http://localhost:5173/?station=8000105&platform=9&design=v3-5x2&provider=iris>

## Using the display

| Action                                     | How                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Full screen                                | press `f`, or double-click the display                                         |
| Switch station, platform, design or source | the quick-switch button at the edge of the display (fades out with the cursor) |
| Diagnostics: failed requests, outages      | press `d`                                                                      |
| Change the whole configuration             | the setup page at `/setup`, which starts from the current display's settings   |

The display is built to be left running: the cursor hides when idle, the screen is kept awake, and if
no data has arrived for a long time the page reloads itself once the network is back.

## Designs

A real platform display is not one picture. It is a set of independent elements (clock, destination,
train number, via stops, message line, platform number) arranged differently on every generation of
hardware. The app mirrors that: a **design** decides which of these elements appear, where, at what
size, and in what style, while the data underneath stays the same.

| `design`           | Shows                                              |
| ------------------ | -------------------------------------------------- |
| `v3-5x2`           | the V3 5X2 platform display                        |
| `v4-5x2`           | the V4 5X2 platform display                        |
| `station-overview` | a departure overview for the whole station         |
| `debug`            | the raw board, deliberately plain, for development |

Coach-sequence data has no working free source, so that part of a display stays in a defined idle
state.

## Data sources

| `provider` | Data                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `iris`     | live departures from DB's IRIS timetable service ([ADR-0002](docs/adr/0002-use-iris-as-primary-departure-data-source.md)) |
| `mock`     | built-in fixtures, no network needed; good for trying designs and for demos                                               |

IRIS is called directly from the browser. There is no backend, no API key and no account.

## Configuration

A display is configured entirely through the URL query, so a configured display is a link you can
bookmark or point a kiosk browser at. The setup page builds this link for you.

| Parameter        | Meaning                                                      | Default       |
| ---------------- | ------------------------------------------------------------ | ------------- |
| `station`        | EVA number (IBNR) of the station, e.g. `8000105`             | required      |
| `platform`       | Platform label, e.g. `9` or `1a`. Omit for the whole station | all platforms |
| `design`         | Design id, see [Designs](#designs)                           | `debug`       |
| `provider`       | Data source id, see [Data sources](#data-sources)            | `mock`        |
| `refreshSeconds` | Poll interval, 10–600                                        | `30`          |
| `horizonMinutes` | How far ahead the board looks, 5–360                         | `120`         |
| `simulatedTime`  | Freeze the clock at this ISO 8601 instant (demo mode)        | live time     |
| `timeFactor`     | Run the clock faster than real time, e.g. `60`               | `1`           |

Invalid values are reported on screen rather than silently replaced: a display showing the wrong
station is worse than one showing an error.

## Running it standalone

The production build is a set of static files. Because the browser talks to IRIS itself, nothing
else has to run next to it.

```sh
npm run build              # writes dist/
npm run preview -- --host  # serves dist/ on port 4173, reachable from the local network
```

To host `dist/` with any other web server (nginx, Caddy, a NAS), two things matter:

- Serve it at the root of a host or port. The build references its assets as `/assets/…`.
- Answer unknown paths with `index.html`, so `/setup`, `/gallery` and `/preview` can be opened
  directly.

Opening `dist/index.html` from the file system does not work; it has to be served over HTTP.

For a dedicated display, start a browser in kiosk mode on the configured link, for example on a
Raspberry Pi:

```sh
chromium-browser --kiosk --noerrdialogs --disable-session-crashed-bubble \
  "http://localhost:4173/?station=8000105&platform=9&design=v3-5x2&provider=iris"
```

## Development

```sh
npm run dev        # dev server with hot reload
npm test           # unit and component tests
npm run lint       # ESLint, including the clock-port rule from ADR-0004
npm run typecheck  # TypeScript only
npm run build      # type-check and production build
```

Two pages sit next to the display for working on it:

| Path       | Shows                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| `/gallery` | every shared display block on its own, in the cases that matter                                             |
| `/preview` | any design against any named scenario: cancellation, platform change, long name, stale data, no data at all |

Where things live:

- `src/domain/`: the display's own model. No API type ever reaches a component.
- `src/providers/`: one adapter per data source, chosen through a registry.
- `src/designs/`: one folder per design, chosen through a registry. Adding a design means adding a
  folder and a registry entry, nothing else.
- `src/components/zza/`: the shared display blocks the designs are assembled from.
- `src/platform/clock.ts`: the only place allowed to read the system clock.

Before contributing, read [AGENTS.md](AGENTS.md) for the architecture rules, branch and commit
strategy, and when a decision needs an ADR. The decisions so far, with the options that lost, are in
[docs/adr/](docs/adr/README.md).

**Tech stack:** Vite · React 19 · TypeScript (strict) · TanStack Query · Zod · CSS Modules with
custom properties · Vitest

## License

[Apache-2.0](LICENSE)

This is a hobby project and not affiliated with Deutsche Bahn.
