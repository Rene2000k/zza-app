# ADR-0007 — Parse IRIS XML with the runtime's native DOMParser

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-09-10

## Context and Problem Statement

The chosen departure data source returns XML rather than JSON, so the provider adapter that reads
it needs some way to turn an XML string into something the mapping code can walk field by field.
The app has no server component: it runs entirely in the browser, calling the data source directly,
and its test suite runs the same code under a DOM-capable test environment rather than plain
Node.js. Whatever does the parsing has to work in both places without special-casing either.

The source's XML shape, as measured, is flat and attribute-heavy — station and departure records
as elements with attributes, no namespaces, no DTD-driven entities, nothing that stresses an XML
parser's more exotic features.

## Decision Drivers

| ID | Driver | Why it matters |
|---|---|---|
| D01 | No added dependency for a mechanical, already-solved task | Every dependency is something to install, update and audit indefinitely |
| D02 | Identical behavior in the shipped app and in the test suite | The adapter must not need a browser-only code path and a separate test-only one |
| D03 | Sufficient for the data's actual shape | The chosen approach only has to handle flat, attribute-based XML, not general-purpose XML processing |

## Considered Options

| Option | D01 | D02 | D03 |
|---|---|---|---|
| **O01** — A parsing library (e.g. `fast-xml-parser`), turning XML into a plain object tree | Con | Pro | Pro |
| **O02** — The runtime's built-in `DOMParser`, walked with standard DOM APIs | Pro | Pro | Pro |

## Decision Outcome

**O02 — the native `DOMParser`.** Responses are parsed with
`new DOMParser().parseFromString(text, 'application/xml')`, and the mapping code reads elements and
attributes through standard `Element`/`NodeList` APIs (`querySelectorAll`, `getAttribute`, and
similar). `DOMParser` is available unmodified in every browser the app targets and inside the
project's DOM-based test environment, so the same code path runs in both without a shim.

The trade-off accepted is ergonomics: walking a `Document` with DOM calls reads a little more
verbosely than a library that hands back a plain JavaScript object ready to destructure. That is
accepted because the data is simple enough that the difference is small, and it buys not adding,
version-pinning or auditing a dependency for a task the runtime already does.

**Consequences.**

- The mapping code works directly against `Document`/`Element` values; anyone extending it reads
  and writes DOM traversal calls, not object-property access.
- No new runtime dependency and no bundle-size cost from this decision.
- **Failure mode to watch:** if a future data source needs XML features `DOMParser` handles poorly
  or inconsistently across environments (heavy namespace use, mixed content, huge documents), this
  decision would need revisiting for that source specifically — not expected here, since the
  measured shape of the chosen source is flat attributes throughout.

## Pros and Cons of the Options

### O01 — A parsing library

Install a package (e.g. `fast-xml-parser`) that converts XML text into a plain JS object tree ready
to read like any other parsed data.

| ID | Driver | Assessment |
|---|---|---|
| D01 | No added dependency | Con — one more package to install, version and keep patched |
| D02 | Same code everywhere | Pro — pure JS, no environment-specific behavior to reconcile |
| D03 | Sufficient for the data | Pro — comfortably handles data this simple, and more besides |

### O02 — Native `DOMParser`

Use the parser every browser (and the test environment) already ships, and read the result with
standard DOM APIs.

| ID | Driver | Assessment |
|---|---|---|
| D01 | No added dependency | Pro — nothing to install; it is part of the runtime already being targeted |
| D02 | Same code everywhere | Pro — the app runs in a browser and tests run in a DOM-capable environment, so no divergent code path is needed |
| D03 | Sufficient for the data | Pro — flat, attribute-based records are exactly what `querySelectorAll`/`getAttribute` handle well |
