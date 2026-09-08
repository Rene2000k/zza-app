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

Early. No application code yet — the repository currently holds the project conventions and the
architecture decision records that the implementation will follow.

The data source is deliberately still open: DB shut down its HAFAS API, and the successor APIs are
unofficial and change without notice. Which client library the project uses will be decided on
measured evidence and recorded as an ADR before any provider code is written.

## Repository

- [AGENTS.md](AGENTS.md) — project conventions: architecture rules, branch and commit strategy,
  React practices, and when an ADR is required.
- [docs/adr/](docs/adr/README.md) — architecture decision records: what was decided, which options
  were weighed, and why the others lost.

## Tech stack (intended)

Vite · React 19 · TypeScript (strict) · TanStack Query · CSS Modules with custom properties · Vitest

## License

Not yet decided.
