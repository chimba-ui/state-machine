# Reactivity delegation — parked idea (revisit after R8)

Status: **parked**. Captured mid-R8 (subscription surface). Do not implement yet;
finish R8 first, then come back to decide whether/how to delegate.

## The idea

The machine's fine-grained `subscribe(selector, listener)` runs a preact
`effect`/`computed` per subscription to do selection + `Object.is` dedup. On a
host that **already has reactivity** (React, Ink, Vue, Solid), that machinery is
**redundant** — the host re-runs the component, compares, and schedules already.
Running the kernel's selection in parallel is a second reactivity engine doing
work the framework would do anyway.

Goal: **delegate selection to the host framework when it exists; only fall back
to the kernel's own selection when it doesn't — and make machines that delegate
pay ~nothing for the kernel path.**

## Three tiers of target (what determines who needs the kernel)

| Tier | Targets | Host reactivity | Selection done by |
| --- | --- | --- | --- |
| Full reactive graph | React DOM, **Ink** (is React), Vue, Solid | yes | host (+ optional coarse subscribe) |
| Component-local | **Lit** (`@state`), **Stencil** (`@State`/store) | re-renders a component, but can't track *which machine slice* was read | **kernel selector** |
| None | **Pixi / raw canvas** | imperative render loop, no tracking | **kernel selector** |

Key correction made during discussion: it is NOT true that "canvas/TUI have no
reactivity." **Ink is React** (full reactivity, use the React bridge unchanged).
The real no-reactivity case is **Pixi/raw canvas**. Lit/Stencil have only
*component-local* reactivity — they know *that* to re-render, not *based on what*
— so they still need the kernel's selector to narrow.

So **Lit, Stencil, Pixi** need the kernel selection path; the full-graph hosts
*could* delegate.

## The realization that shapes the API

"Which machines need the kernel path" is **not a per-machine property** — it's a
property of **the render target / adapter**. Every machine in a React app
delegates to React; every machine on a Pixi canvas needs the kernel. You won't
mix within one app. Therefore the switch belongs at the **connector boundary
(R9)**, NOT a per-instance flag (a flag would be the same value for every machine
in an app — manual + error-prone + redundant with the connector).

Compare Zag: it stays coarse at the core and ships `@zag-js/react`, `-vue`,
`-solid`, `-svelte` — **the per-target package IS the switch**, and each leans on
the host's native reactivity. Zag can do this because *all* its targets have a
full reactive graph. We can't, because Pixi/Lit/Stencil don't — so the
fine-grained primitive must live on the machine, but be **opt-in by connector.**

## Proposed design (to evaluate later)

1. Machine always exposes **raw signals** (`m.state`, `m.context.x`,
   `m.computed.y`) — these are just reads, **zero subscription cost until
   observed**.
2. Machine exposes the fine-grained `subscribe(selector?, listener)` primitive —
   **costs only when called** (creates one effect per subscription).
3. **Connectors (R9) are the per-target switch:**
   - React / Ink → `useSyncExternalStore` over a **coarse** notify (or read
     signals inside render); **does not** engage the kernel selector path.
   - Vue / Solid → read `m.context.x` inside the host's reactive scope; host
     tracks. Kernel selector unused.
   - Pixi / Lit / Stencil → **call** `m.subscribe(selector, listener)` because
     there is no host to delegate to.
4. No per-machine `reactive` flag. "Needs it" = which connector wraps it.
   Because not calling `subscribe(selector,…)` creates no effect, **machines that
   delegate pay nothing** — the cost is automatically borne only by the machines
   that call it (the ones on tier-2/3 targets).

## The assumption this rests on (MUST verify before committing)

The whole "others don't pay" property hinges on: **an unobserved preact
`computed`/`signal` costs ~nothing.**
- `signal`: value + version, cheap.
- `computed` with **no subscriber**: lazy — its fn never runs.
- `effect`: exists only if you create one.

If true: a machine whose connector only *reads* signals and never calls
`subscribe(selector,…)` creates no effects → no ongoing cost. ✅

**TODO when we revisit:** micro-bench — N (≈5k) machines with computeds defined
but ZERO subscribers; assert (a) computed fns never invoked, (b) memory roughly
flat vs machines without computeds. If it holds, the connector-switch design is
sound. If not, reconsider.

## Connection to the preact-over-alien decision

Same thread: we put a real signal kernel in the core specifically so the
non-Solid/Vue/React targets (Lit, Stencil, canvas) inherit fine-grainedness from
the machine instead of each reinventing it. The kernel is **mandatory for Pixi**,
**needed-to-narrow for Lit/Stencil**, and **convenient/optional for React/Ink/
Vue/Solid** (which can delegate). preact won on stability + proven at scale
(canvas26) + perf wash — but the reason for a kernel *at all* is the Pixi tier.

## Open questions for the revisit

- Does the delegation policy live entirely in R9 connectors (lean: yes), with R8
  shipping only the neutral primitive?
- For full-graph hosts, do we still want a **coarse** `subscribe` (wake-on-any)
  for the `useSyncExternalStore` bridge, or do those connectors read signals
  directly? (Probably want coarse available.)
- Benchmark the unobserved-cost assumption (above) before locking.
