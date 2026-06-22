---
"benchmark": minor
---

Document the current benchmark methodology.

The suite measures `@dunky.dev/state-machine`'s hot paths in isolation and compares the runnable parts against XState and Zag. It runs in one Node process with `--expose-gc` (Node 24, Apple Silicon for the published figures); each section is also exported as a `run*()` function for isolation.

Fairness rules that define what the numbers mean:

- **Synchronous-only comparison in ops/sec loops.** Dunky and XState `send` synchronously and are measured everywhere; Zag's `send` is microtask-batched (async), so it appears only where it runs synchronously — construction, memory (headless `VanillaMachine`), and React rendering (`@zag-js/react`). A tight `tinybench` loop can't fairly time an async engine, so those cells are marked `n/a ᵃ`. Missing first-class primitives (e.g. XState has no lazy/memoized `computed`) are marked `n/a ᶠ`.
- **Shared module-level config across instances.** All engines reuse one `const` config — matching how a real app declares a machine once and instantiates it many times — so construction/memory loops time machine construction, not config-literal allocation.
- **Two XState variants** in fine-grain tables: `xstate` (subscribe + hand-written value diff, matching Dunky's built-in dedup) and `xstate-raw` (stock subscribe, fires on every snapshot).

Sections: fan-out / fine-grain / throughput, compose / synced machines, computed, engine hot paths (guards, state/effect/sub churn), construction cost, memory per machine (thin 2-field vs fat 64-field), and React rendering (rows-woken-per-move + wall-clock under jsdom).

Absolute figures vary by machine, Node version, and thermal state — the ranking and scaling shape are what hold. Run it with `pnpm benchmark`. Full methodology and per-scenario tables: [`benchmark/README.md`](https://github.com/dunky-dev/state-machine/tree/main/benchmark#readme).
