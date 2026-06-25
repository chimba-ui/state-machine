# Agent + contributor guide

The working contract for anyone (human or agent) modifying code in this
repo. This file is the canonical entry point — read it first, every time.

## Preflight

Before touching any code, read these in order:

1. `AGENTS.md` (this file) — rules, boundaries, workflow.
2. `README.md` — what this project is and how to run it.
3. `ARCHITECTURE.md` — the layered model and where things live.

If a per-package `AGENTS.md` exists alongside a `package.json`, read it
before editing files in that package — it overrides anything here for
that scope.

## Boundaries

These are not preferences. They are invariants. Violating them breaks
the layered model:

- **Core never imports a substrate.** No React, no React Native, no
  DOM, no `window`, no `document`. `packages/core/*` is pure
  TypeScript. If you reach for a substrate API in `core/`, stop — the
  code belongs in a target.
- **Targets never reimplement state.** Targets read from the machine
  via its connector. They do not fork the state graph, mirror context,
  or shadow transitions. If a target needs new state, the state goes in
  `core/`.
- **Substrate quirks live in the target.** Focus traps, escape-key
  listeners, back-button handling, RN gesture quirks are
  prop-dependent, so they live in the target as `ComponentEffect`s.
  Props-free, platform-free effects belong in the core machine config's
  `effects` (authored via `setup()`).

## Workflow

### Where does the code go?

Three package groups, three jobs — never cross the lines:

- **`packages/core/`** — agnostic behavior only. Pure TypeScript, no renderer,
  no DOM, no `window`. States, transitions, guards, actions, effects, connector,
  compose. If it touches a platform API, it belongs in a target.
- **`packages/shared/`** — cross-target, cross-component helpers (mergeProps,
  composeHandlers, positioning, memo). No machine logic, no runtime.
- **`packages/<target>/`** (`react`, `native`, …) — one package per substrate.
  Owns the lifecycle bridge (`useMachine`), the props translator (`normalize`),
  and platform effects (`ComponentEffect`s). Nothing here reimplements state.

### The machine never sees props

Props enter only at the **edge** — the connector / connect function — never
inside the machine config:

- **Config the machine needs** (delays, flags) → seed into `context` once, update
  via `setContext` when props change.
- **Callbacks and controlled state** (`onOpenChange`, controlled `open`) → handled
  by the connector; it observes the machine and calls back via reactions.
- **Initial state from props** → computed before `machine()` is built.

Breaking this rule couples the machine to one runtime. The same config must run
byte-for-byte identically on React, React Native, a canvas loop, or a test.

### Where does a side-effect go?

Ask one question: does it need props or a platform API?

- **No** → core config effect. Register it in `setup({ effects })`, name it on a
  state. Scoped to that state, auto-cleaned on exit.
- **Yes** → `ComponentEffect` in the target package. A plain
  `(machine, props) => cleanup` tuple with the prop names it reads. On trigger,
  it `send()`s a plain event the machine already understands.

### Before merging

1. New or changed behavior in `core/` must have a test in that package's `tests/`.
2. Check the change is substrate-agnostic — no React lifecycle, no DOM API, no
   RN-only import inside `packages/core/`.

## Diagrams in docs

Draw ASCII diagrams (boxes, trees, flows) with plain `|`, `-`, and `+`
only — never Unicode box-drawing characters (`┌ ┐ └ ┘ ─ │ ├ ┼ ▼` …).
Use `|` for verticals, `-` for horizontals, `+` for every corner and
junction, and a plain `v` / `^` / `>` / `<` for arrowheads. The
box-drawing glyphs render inconsistently across fonts, terminals, and
GitHub, and are awkward to edit; the ASCII set is portable and diffs
cleanly. This applies to every `.md` in the repo (README, ARCHITECTURE,
package READMEs).

## Code

### Performance

- **Performance is a constraint, not a feature.** Prefer mutation over allocation on hot paths.
  Avoid spreading objects, chaining array methods, or allocating closures inside loops.
- **Descriptive names everywhere.** Short names are fine for
  local variables with a tight, obvious scope.
- **Comments.** If the code says what it does, the comment is
  noise. Write comments to explain _why_: a hidden constraint, a subtle invariant, a
  workaround, a hard decision. Keep them short, avoid over explaining to avoid noise.

### Testing

- **No overlapping tests.** Each test covers one distinct behavior. Do not write a test that
  is already an implicit consequence of another test passing.
- **Shared setup goes at the top of the file.** If multiple tests need the same machine config
  or helper, define it once at the top — not inside each `it()`.
- **Reusable multi-file fixtures go in `tests/fixtures/`.** Anything shared across test files
  lives there, not inlined or duplicated.

## Benchmark

When the user asks to run the benchmark, check performance, or run perf
tests, invoke the `/benchmark` skill. Do not run the benchmark manually
or interpret results without it — the skill handles execution, output
formatting, and prompts before updating any documented result tables.

## Per-package guidance

If a package needs rules of its own (build quirks, platform-only
constraints), add an `AGENTS.md` next to its `package.json`. The same
convention applies further down the tree — anywhere a directory has
rules its parent doesn't capture.

Resolution is nearest-wins: an `AGENTS.md` inside the directory you
are editing (or any ancestor up to the repo root) overrides everything
above it for that directory's code. When editing a file, read every
`AGENTS.md` between the repo root and that file, apply them top-down,
and let the closest one settle conflicts.

Keep nested files small. Only encode what genuinely differs from the
ancestor — duplicating rules invites drift. If a nested file would
just restate the root, delete it.
