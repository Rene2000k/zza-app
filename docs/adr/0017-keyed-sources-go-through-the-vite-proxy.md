# ADR-0017 — Sources that need a key go through a proxy in the Vite server

- **Status:** accepted
- **Deciders:** maintainer
- **Date:** 2026-11-26

## Context and Problem Statement

The app is a static browser build that each user runs locally from a public repository. When the
departure source was chosen, one requirement was that a source must be usable from the browser
without a server in front of it. A free key that each user registers for themselves and keeps in a
local, untracked file was acceptable. IRIS meets this because it answers with
`Access-Control-Allow-Origin: *` and needs no key, so the browser calls it directly.

The first source that does not is the bahnhoftafel.de API, chosen for tagesaktuelle Wagenreihungen.
Measured on 2026-11-26:

- it requires `Authorization: Bearer bt_…`, a per-user key;
- its answers carry no `Access-Control-Allow-Origin`;
- its documentation says browser calls are not provided for and the key belongs on a server.

A browser `fetch` to it fails the CORS check, while `curl` with the same key answers 200. Even with
CORS, the key would be readable by anyone who can open the page, and a key that Vite bundles into the
build (any `VITE_` variable) ends up in `dist/`.

The app already runs inside Vite's server in both ways it is used:

- `npm run dev` for development;
- `vite preview` on port 4173, which the README's kiosk example points a browser at.

The dev server already serves the git-ignored `local-data/` folder through a small plugin.

The question this record settles: how does a source that needs a key, and sends no CORS headers,
reach the browser? The decision applies to every future source of that kind, not only this one.

## Decision Drivers

| ID  | Driver                                     | Why it matters                                                                                                |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| D01 | The key never reaches the browser          | It is personal, it can be locked for misuse, and the repository is public: no key in a bundle or a page       |
| D02 | Nothing extra to run                       | Users start the app with one command today, and a kiosk runs it all day; a second process is a second failure |
| D03 | The static build stays usable without it   | Sources without a key, IRIS above all, must keep working when `dist/` is served by any web server             |
| D04 | One mechanism for every key-bearing source | The next source with a key should add a line of configuration, not a new piece of infrastructure              |

## Considered Options

| Option                                                                  | D01 | D02 | D03 | D04 |
| ----------------------------------------------------------------------- | --- | --- | --- | --- |
| **O01** — Proxy in the Vite server (`server.proxy` and `preview.proxy`) | Pro | Pro | Pro | Pro |
| **O02** — A separate small Node proxy in the repository                 | Pro | Con | Pro | Pro |
| **O03** — Each user runs a proxy of their own; the app is given its URL | Pro | Con | Pro | Con |
| **O04** — Key in the browser, as a `VITE_` variable                     | Con | Pro | Pro | Pro |
| **O05** — A public CORS proxy                                           | Con | Pro | Pro | Pro |

## Decision Outcome

**Recommendation: O01.** `vite.config.ts` declares one proxy entry per key-bearing source, under
`/api/<source>`, for both `server.proxy` and `preview.proxy`. The entry forwards to the source and
adds its `Authorization` header from an environment variable. Vite's config reads that variable with
`loadEnv` from the git-ignored `.env`, under a name without the `VITE_` prefix, so it never enters
the bundle. For bahnhoftafel this is `/api/bahnhoftafel` → `https://developer.bahnhoftafel.de/v1`,
with the key in `BAHNHOFTAFEL_API_KEY`. The browser asks its own origin, so CORS does not apply.

The provider talks only to the proxy path. It reports a missing key (401 or 403) and a missing proxy
(404, or an HTML page in place of JSON) as errors in the diagnostics, and its data as absent.

O01 wins because it uses a server that is already running. Both ways the app is started today go
through Vite, so the key is attached with no new process, and adding a source means adding a
configuration entry.

Accepted trade-off: sources that need a key work only while the app runs through Vite (`npm run dev`
or `vite preview`). A `dist/` folder served by nginx or any other static host has no proxy, and those
sources then report themselves as unavailable. That is acceptable because the kiosk setup already uses
`vite preview`, and every source without a key keeps working from a plain static host.

**Consequences.**

- The display now depends on a Node process staying up for key-bearing sources. That is already true
  for `vite preview`.
- A user who serves `dist/` statically and wants these sources has to set up an equivalent proxy
  rule in their own server. The README has to say so.
- `.env` must stay git-ignored. A key that leaks is locked by the source, not by us.
- It stops working if Vite drops or changes `preview.proxy`, or if a source starts checking the
  requesting origin. The fallback is O02: a standalone proxy with the same routes, so the providers
  keep their paths.

## Pros and Cons of the Options

### O01 — Proxy in the Vite server (`server.proxy` and `preview.proxy`)

Vite forwards `/api/<source>/…` to the source and adds the key from `.env`. It does this in the dev
server and in `vite preview`.

| ID  | Driver                                     | Assessment                                                                                |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| D01 | The key never reaches the browser          | Pro — added on the server side; the variable has no `VITE_` prefix, so it is not bundled  |
| D02 | Nothing extra to run                       | Pro — the server the app already runs in                                                  |
| D03 | The static build stays usable without it   | Pro — the build is unchanged; only the key-bearing sources are missing from a static host |
| D04 | One mechanism for every key-bearing source | Pro — one configuration entry per source                                                  |

Vite 8.2.2 is in use. `preview.proxy` falls back to `server.proxy` when it is not set. Declaring both
explicitly keeps the intent visible.

### O02 — A separate small Node proxy in the repository

A script that serves the same `/api/<source>` routes and is started next to the app.

| ID  | Driver                                     | Assessment                                                                |
| --- | ------------------------------------------ | ------------------------------------------------------------------------- |
| D01 | The key never reaches the browser          | Pro — same as O01                                                         |
| D02 | Nothing extra to run                       | Con — a second process to start, keep alive and update, and a second port |
| D03 | The static build stays usable without it   | Pro — it could even sit next to a static host                             |
| D04 | One mechanism for every key-bearing source | Pro — one route per source                                                |

The fallback if O01 stops working, and the option of choice if the app is ever served without Vite.

### O03 — Each user runs a proxy of their own; the app is given its URL

The app is configured with a proxy URL per source. Setting up that proxy is left to the user.

| ID  | Driver                                     | Assessment                                                                  |
| --- | ------------------------------------------ | --------------------------------------------------------------------------- |
| D01 | The key never reaches the browser          | Pro — if the user's proxy attaches it                                       |
| D02 | Nothing extra to run                       | Con — the user has to build and run it                                      |
| D03 | The static build stays usable without it   | Pro — the build is unchanged                                                |
| D04 | One mechanism for every key-bearing source | Con — every user solves it anew, and the app cannot rely on any route shape |

### O04 — Key in the browser, as a `VITE_` variable

The key is bundled and the browser sends it directly.

| ID  | Driver                                     | Assessment                                                         |
| --- | ------------------------------------------ | ------------------------------------------------------------------ |
| D01 | The key never reaches the browser          | Con — the key is in the bundle and in every request the page makes |
| D02 | Nothing extra to run                       | Pro — nothing to run                                               |
| D03 | The static build stays usable without it   | Pro — unchanged                                                    |
| D04 | One mechanism for every key-bearing source | Pro — a variable per source                                        |

It does not work anyway: without CORS headers the browser refuses the answer, whatever the key.

### O05 — A public CORS proxy

A third-party service that forwards requests and adds CORS headers.

| ID  | Driver                                     | Assessment                                                                |
| --- | ------------------------------------------ | ------------------------------------------------------------------------- |
| D01 | The key never reaches the browser          | Con — the key is in the page, and every request hands it to a third party |
| D02 | Nothing extra to run                       | Pro — nothing to run                                                      |
| D03 | The static build stays usable without it   | Pro — unchanged                                                           |
| D04 | One mechanism for every key-bearing source | Pro — one prefix per source                                               |

It also goes against the bahnhoftafel terms, which forbid passing a key on.
