# agnostic-render

Research project: one definition of how a component _behaves_, reused
across web (React DOM), mobile (React Native), and future targets.

## Mental model

```
   ┌─────────────────────────────────────────────────────────────────┐
   │                                                                 │
   │   HOST  ─  the substrate-agnostic core                          │
   │                                                                 │
   │     packages/core/machine                                       │
   │     packages/core/components/<name>                             │
   │                                                                 │
   │     - state machine (closed → opening → open → closing)         │
   │     - bindings vocabulary (onPress, describedBy, role, …)       │
   │     - style spec (paint-only, agnostic)                         │
   │     - declares effects by name; some as no-op placeholders      │
   │                                                                 │
   │     Knows nothing about React, the DOM, or any renderer.        │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
                                  │
                                  │  declares contract
                                  ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                                                                 │
   │   ADAPTER  ─  the substrate-specific connector                  │
   │                                                                 │
   │     packages/react/...           packages/native/...            │
   │     packages/{surface,...}       (future targets)               │
   │                                                                 │
   │     - useMachine hook (React lifecycle bridge)                  │
   │     - normalize (bindings → renderer-native props)              │
   │     - style-engine (style spec → renderer-native styles)        │
   │     - adapter.ts per component (effect impls for this           │
   │       substrate: DOM listeners on web, BackHandler on RN, …)    │
   │                                                                 │
   │     Fulfills the host's contract for one render target.         │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
                                  │
                                  │  consumed via generated api.ts
                                  ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                                                                 │
   │   COMPONENT  ─  the view a consumer imports                     │
   │                                                                 │
   │     packages/<target>/components/<name>/                        │
   │                                                                 │
   │     - render.tsx — the actual JSX/View                          │
   │     - elements.ts — generated styled wrappers                   │
   │     - api.ts — generated useXxxApi hook                         │
   │                                                                 │
   │     One per (target × component): Tooltip-React, Tooltip-Native │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                              consumer app
                       (sandbox/react, sandbox/native, …)
```

## Glossary

| Term         | Lives in             | What it does                                              |
| ------------ | -------------------- | --------------------------------------------------------- |
| **host**     | `packages/core/`     | Defines the contract — state graph, bindings, style spec. |
| **machine**  | `core/machine`       | The state-machine engine + `createMachine`.               |
| **bindings** | `core/machine`       | Substrate-agnostic event/attr vocabulary (`onPress`, …).  |
| **adapter**  | `packages/<target>/` | Supplies substrate-specific effect impls + translators.   |
| **target**   | `react`, `native`, … | A render environment with its own adapter.                |
| **codegen**  | `scripts/build.ts`   | Emits `elements.ts` + `api.ts` per (target × component).  |

## The one-sentence claim

> Each adapter provides a typed map of effect implementations to its host
> machine — and a translator from the host's logical bindings to the
> renderer's native props.

Everything else is plumbing around that claim.

## Workflow

| Command              | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `pnpm codegen`       | One-shot: regenerate `elements.ts` + `api.ts` in each adapter. |
| `pnpm codegen:watch` | Watcher: regenerates per component on changes under `core/`.   |
| `pnpm dev:react`     | Watcher + Vite dev server for the React sandbox.               |
| `pnpm dev:native`    | Watcher + Expo for the React Native sandbox.                   |
| `pnpm dev:pixi`      | Watcher + Vite for the Pixi sandbox.                           |
| `pnpm typecheck`     | `tsc --noEmit` across the workspace.                           |
| `pnpm test`          | `vitest`.                                                      |
| `pnpm build`         | Codegen + production build of the React sandbox.               |

Codegen reads each component's `core/components/<comp>/src/elements/` and
`index.ts`. Editing styles or behavior triggers regeneration via the
watcher; Vite / Metro pick up the regenerated files and HMR.

## Going deeper

- [`AGENT.md`](./AGENT.md) — rules for modifying code in this repo.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the layered model and where things live.
- Each component has a `SPEC.md` describing its behavior, styles, and accessibility.
