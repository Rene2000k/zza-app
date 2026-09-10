# AGENTS.md — Project Conventions for ZZA-Display

This file applies to everyone working in this repo (humans and AI agents alike). English is the
project language: code, comments, commit messages, and documentation are all written in English.

## Project Context

A recreation of a German railway (DB) departure display (ZZA) as a React app. A display is composed
of swappable display components (clock, destination, train number, coach layout, marquee, platform,
…). A "design" describes which components render where, at what size, and with what look; multiple
designs must be able to coexist. Data source: real-time DB train data.

Tech stack:

- Vite + React 19 + TypeScript (`strict: true`)
- TanStack Query for server/polling state
- Zustand (or React Context) for UI/configuration state
- CSS Modules + CSS Custom Properties (no Tailwind — pixel accuracy over utility classes)
- Vitest + Testing Library, optionally Playwright for visual tests

Architecture rule: layers depend only downward (App → Design → View-Model → Domain model → Provider
→ Transport). A design never knows about a provider, and no vendor/API type may leak into a React
component — always go through the domain model.

## Branch Strategy

- **Never develop directly on `main`.** Every change happens on its own feature branch
  (`feature/<short-description>`, `fix/<short-description>`, etc.).
- `main` is the protected main branch and only receives changes through a merged pull request.
- Feature branches get descriptive names indicating scope and goal, e.g. `feature/mock-provider`,
  `fix/clock-drift`.
- Before starting new work: branch off `main`, not off another still-open feature branch.

## Commit Rules

- **Implementation and commit are separate steps. Do not commit work in the same pass that produced
  it.** Finish the change, report what was done, and leave it in the working tree for the maintainer
  to review. Committing happens afterwards — on request, or by the maintainer. Review usually leads
  to adjustments, and those belong in the change itself rather than in a follow-up commit.
- **Atomic commits.** Each commit contains exactly one logical, self-contained change (e.g. one
  type, one component, one fix). No commit mixes multiple unrelated changes or bundles pure
  formatting with functional changes.
- Commit messages explain **why**, not just what; imperative mood, short subject line (≤ 72
  characters).
- **Keep them short: a subject line plus one or two explanatory sentences.** No wall of text, no
  section headings, no bullet lists, no restating the diff. If the reasoning needs more room than
  that, it belongs in an ADR — and the commit message just names the decision and points at it.
- **History shows reviewed, approved states — never the back-and-forth that produced them.** A commit
  is what a feature looked like when it was agreed, not a diary of attempts, fixes and reversals.
- **Corrections are therefore always folded into the commit they belong to**, as long as that commit
  is still local/unpublished (not pushed, and not part of an open PR others are reviewing):
  - the commit is the last one → `git commit --amend`;
  - the commit sits further back → **rebase** to fold the correction into it.
  - Never a separate "fix typo", "address review comment" or revert commit on unpublished history, and
    never a follow-up commit that removes something an earlier commit should not have contained.
  - Exception: once a commit has been pushed and is referenced or reviewed by others, the correction
    becomes a new, separate commit instead of rewriting published history.
- No `--no-verify`, no skipped hooks, no rebase/amend on commits that are already merged.

## Architecture Decision Records (ADR)

**Every non-trivial decision is recorded as an ADR in `docs/adr/`.** Not optional.

**The decision itself belongs to the maintainer, not to the agent.** An agent's job is to *prepare*
the ADR — context, measurements, alternatives, and a clear recommendation — with status `proposed`,
and then ask. Only the maintainer's answer turns it into `accepted`. Never mark an ADR `accepted` on
your own authority, and do not implement a decision that needs an ADR before it has been accepted.
Writing down the options is expected and welcome; choosing between them is not the agent's call.
(ADR-0001 is the one exception: it was accepted when the practice itself was set up.)

A decision needs an ADR when **any** of these is true:

- It constrains future code beyond the change at hand (a library, an API, a data source, a layer
  boundary, a naming or file-layout convention).
- A viable alternative was rejected — anything worth the sentence "we considered X instead".
- Someone reading the code in six months would ask "why is it done this way?" and not find the
  answer in the code.
- It is a **result of research or evaluation work** — the chosen client library, the coach-sequence
  source, the font, the polling interval derived from a measured rate limit. These are always ADRs,
  and they carry the measurements that led there, not just the verdict.

ADR-free, even when a choice was involved:

- Trivial, locally reversible choices with no rejected alternative worth naming — variable names, the
  order of props, extracting a helper function, formatting.
- **Project housekeeping that does not shape the software**: which license the repository carries,
  what the repository is called, which tool version is required because the tooling demands it. These
  are decisions, but not *architecture* decisions — they belong in the file that carries them
  (`LICENSE`, `package.json`, `.nvmrc`) and, where the reasoning matters, in a sentence there.

The test is whether the decision constrains how the software is built or behaves. If it only
constrains paperwork, it is not an ADR.

**ADRs are self-contained and must not reference internal planning documents.** `docs/plan/` is
internal working material and stays out of the ADRs — no links, no "see phase 2". Anything needed to
understand the decision is restated in the ADR itself, so it stands on its own for a reader who only
ever sees `docs/adr/`.

**Commit timing.** An ADR whose decision is implemented right away ships in the same commit as the
implementation. A decision taken **ahead** of any implementation — research results, a choice that
has to be settled before work can start — gets its own commit; that is normal and expected. What
must not happen is an ADR written *after* the implementation as retroactive justification.

Mechanics — numbering, template, index, superseding — live in [docs/adr/README.md](docs/adr/README.md).
Read it before writing the first ADR of a session. Short version:

- One file per decision: `docs/adr/NNNN-short-slug.md`, four-digit sequential number, never reused.
- Copy [docs/adr/template.md](docs/adr/template.md) and keep its MADR-style sections and their order:
  Context and Problem Statement → Decision Drivers (`D01…`) → Considered Options (`O01…`, with a
  comparison table rating each option Pro/Con/Undec per driver) → Decision Outcome (recommendation,
  accepted trade-off, consequences) → Pros and Cons of the Options (one assessment table per option).
- Add the ADR to the index table in `docs/adr/README.md` in the same commit.
- A decision that is later reversed is **not** edited away: the old ADR gets status `superseded by
  ADR-NNNN`, and the new one gets its own file. The trail of wrong turns is the point.

## React Best Practices (React 19 / TypeScript)

- **Function components + hooks** only; no class components.
- **Server/remote state belongs in TanStack Query**, not in `useState`/`useEffect`. Custom
  `useEffect` data-fetching logic only when TanStack Query demonstrably doesn't fit.
- **Use `useEffect` sparingly** — only for genuine synchronization with systems outside React
  (subscriptions, DOM, timers). Derived state is computed during render, not pushed into another
  state via an effect.
- **Props over context for local data flow**; context/store only for cross-cutting state
  (configuration, theme, design selection). No global store "just in case".
- **Composition over inheritance/prop explosion**: generic building blocks (`components/zza/…`)
  stay dumb and reusable; design-specific layout lives in `designs/<name>/…`.
- **No `any`, no `as`-cast as an escape hatch.** Use types from the domain model (`domain/*.ts`);
  provider/API types stay encapsulated inside `providers/<name>/`.
- **Stable `key` props** (a domain ID, never an array index for mutable lists).
- **Memoize (`useMemo`/`useCallback`/`React.memo`) only once a need is demonstrated**, not
  preemptively — it has its own costs and bugs (stale closures).
- **Error/offline states are display states**, not a `try/catch` sprawl: TanStack Query exposes
  `status`/`error`, and the UI renders a defined state for it instead of crashing.
- **Accessibility where it makes sense**: semantic HTML, `aria-live` for content that updates on its
  own (departure times, platform changes), even though pixel accuracy to the real display takes
  priority over web conventions.
- No premature abstraction: three similar lines beat an early generic component/hook built for a
  hypothetical future case.
