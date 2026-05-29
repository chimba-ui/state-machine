# Architecture

For _rules_ (do this, never do that), see [`AGENT.md`](./AGENT.md).
For _packages_ specifics see `SPEC.md` files.

```
   ┌─────────────────────────────────────────────────────────────────┐
   │                          HOST (core)                            │
   │                                                                 │
   │   Pure JS. No React, no DOM, no RN. Substrate-agnostic.         │
   │                                                                 │
   │   Provides:                                                     │
   │     • State-machine engine (createMachine)                      │
   │     • Reactive store (createStore)                              │
   │     • Bindings vocabulary (EventBindings, AttrBindings)         │
   │     • Style spec types (Style, StyleSpec)                       │
   │     • Per-component agnostic spec (states, transitions,         │
   │       connect output, element style specs)                      │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │  declares a contract
                                  │  (effect names, bindings vocab)
                                  ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                  ADAPTER (per-substrate)                        │
   │                                                                 │
   │   Knows one renderer. Implements the host's contract.           │
   │                                                                 │
   │   Provides:                                                     │
   │     • useMachine hook (React lifecycle bridge)                  │
   │     • normalize (bindings → renderer-native props)              │
   │     • style-engine (style spec → renderer-native styles)        │
   │     • mergeProps (consumer + library prop composition)          │
   │                                                                 │
   │   Each component in this layer adds:                            │
   │     • adapter.ts (substrate impls of host effects)              │
   │     • render.tsx (the actual view)                              │
   │     • context.ts (adapter-specific React context)               │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │  consumed via generated api.ts
                                  │  (useXxxApi hook + styled elements)
                                  ▼
                              consumer app
                       (sandbox/react, sandbox/native, …)
```

The arrows point upward because the lower layer is the _contract_ the
upper layer fulfills. Core declares names; adapters supply the runtime.

---

## Where things live

| File / location                        | What it owns                                         |
| -------------------------------------- | ---------------------------------------------------- |
| `packages/core/machine/`               | State-machine engine, store, bindings, mergeProps    |
| `packages/core/components/<comp>/`     | Per-component agnostic spec — see structure below    |
| `packages/<target>/machine/`           | Hook + normalize per substrate (react, native, pixi) |
| `packages/<target>/style-engine/`      | Style spec translator per substrate                  |
| `packages/<target>/components/<comp>/` | View, context, adapter, generated elements + api     |
| `scripts/build.ts`, `scripts/watch.ts` | Codegen (one-shot + watcher)                         |
| `sandbox/<target>/`                    | Runnable demos                                       |

### Per-component layout (core)

```
core/components/<comp>/src/
├── index.ts        public barrel
├── types.ts        vocabulary (types only)
├── props.ts        defaults + resolver
├── machine.ts      MachineConfig only (states + transitions + impls)
├── connect.ts      logical surface (handlers + attrs the view consumes)
├── store.ts        singleton state (when the component has one)
├── utils.ts        pure algorithmic helpers (step, typeahead, …)
├── elements/
│   ├── index.ts    barrel + parts list
│   └── <part>.ts   one file per element (content, positioner, …)
└── SPEC.md         behavior + styles + a11y for this component
```

### Per-component layout (adapter)

```
<target>/components/<comp>/src/
├── index.ts        public barrel
├── render.tsx      the view (hand-written)
├── context.ts      adapter-specific context
├── adapter.ts      substrate impls of host effects (DOM listeners, …)
├── utils.ts        adapter-local helpers (refs, cloning, anchor math)
├── api.ts          GENERATED — useXxxApi hook
└── elements.ts     GENERATED — styled wrappers
```

`api.ts` and `elements.ts` are overwritten on every codegen. The other
files are hand-written and codegen never touches them.

---

## Why the splits

### Why machine, connect, and store are separate files

`machine.ts` is the state graph (states, transitions, action impls). It
changes when behavior changes.

`connect.ts` is the function that translates `(state, context, props)`
into the surface a view consumes (handlers + attrs per part). It changes
when the API surface changes.

`store.ts` holds the singleton when a component has one (e.g. "only one
tooltip open at a time"). It changes rarely; lifting it out makes the
coupling visible at the import line.

Same intuition as Zag.js's machine package layout, minus the DOM file.

### Why elements is a folder, not a single file

Each part of a component (content, positioner, item, separator, …) gets
its own file. The codegen iterates the `elements/` directory; new parts
are picked up by adding a file. Variants and style specs co-locate with
the part, which is the unit you usually edit.

A single `styles.ts` was the original shape and became unwieldy at 6+
parts. The split also lets future per-part metadata (primitive type,
a11y annotations) live next to its element.

### Why machine-core hosts mergeProps and createStore

These are general-purpose primitives every adapter or component might
need. They live in `core/machine` because that's the canonical "shared
substrate-agnostic JS" package. Putting them in adapters would force
duplication; putting them in a new package would add ceremony.

### Why the host declares effects but adapters implement them

Some effects only make sense per substrate: a `trackEscapeKey` effect
on web uses `document.addEventListener`; on RN it uses `BackHandler`;
on a TV remote app it'd watch the remote's events. The machine declares
the effect by _name_ and provides a no-op placeholder; each adapter
overrides the named entry via `withAdapter()`. This keeps the machine
substrate-free without losing the contract.

---

## The codegen pipeline

The build script reads each component's core spec and produces two
adapter files:

```
   core/components/<comp>/src/        (source of truth)
   ├── index.ts                       reads: machine, connect, types names
   └── elements/<part>.ts             reads: style specs

                  ↓  scripts/build.ts
                  ↓  (translate per target)

   <target>/components/<comp>/src/
   ├── api.ts                         emitted: useXxxApi hook
   └── elements.ts                    emitted: styled wrappers
```

The watcher (`scripts/watch.ts`) tracks `core/components/*/src/elements/`
and the per-component sibling files (`machine.ts`, `types.ts`, `props.ts`,
`utils.ts`). On change, the affected component is regenerated for every
target; Vite / Metro pick up the new generated files and HMR.

What codegen does NOT touch: `render.tsx`, `context.ts`, `adapter.ts`,
`utils.ts`, or `index.ts` in any adapter. Those are the
hand-written-once files.

---

## Vocabulary

| Term         | What it is                                                             |
| ------------ | ---------------------------------------------------------------------- |
| **host**     | The agnostic core — `packages/core/*`. Declares what a component is.   |
| **adapter**  | A substrate-specific implementation package — `packages/<target>/*`.   |
| **target**   | A render environment (`react`, `native`, `pixi`, …).                   |
| **machine**  | A state-graph config consumed by `createMachine`.                      |
| **connect**  | A function returning the logical surface a view spreads onto elements. |
| **bindings** | The substrate-agnostic event + attr vocabulary core's connect speaks.  |
| **store**    | A reactive container (shared singleton, per-instance, or both).        |
| **element**  | A named part of a component (content, trigger, item, …) with a style.  |
| **codegen**  | The build-time emission of `elements.ts` and `api.ts` per target.      |

---

## Where to read next

- [`AGENT.md`](./AGENT.md) — rules. What to do, what never to do.
- Each component's `SPEC.md` — behavior, styles, and a11y in human terms.
- `packages/core/machine/src/` — the agnostic primitives (machine, store, bindings, mergeProps).
- `scripts/build.ts` — codegen source. Read this if you want to understand exactly what gets emitted.
