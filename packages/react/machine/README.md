# `@render-experiment/machine-react`

The **React bindings** for [`@render-experiment/machine-core`](../../core/machine).
The core engine is renderer-agnostic; this package is the thin React edge that
drives it: it builds the machine + connector, runs the React lifecycle, bridges
the connector's snapshot into React rendering, translates the agnostic binding
vocabulary into DOM props, and owns the per-component substrate effects.

Everything here is deliberately small — the behavior lives in the core machine
and the component's `connect`; this layer only adapts them to React.

---

## `useMachine` — the one bridge hook

Every component's generated `useXxxApi` calls this with the four agnostic pieces:

```ts
const { api, machine } = useMachine(
  tooltipMachineConfig, // (props) => config  — config factory, props seed it ONCE
  connectTooltip, // pure connect(): snapshot → view api
  tooltipAdapter, // platform machine-effect impls (withAdapter)
  resolved, // props with defaults applied
)
```

It:

- **builds once** (in `useMemo`) — `machine(withAdapter(createConfig(props), adapter))`
  + `connector(service, connect, props)`. The first render's props seed context
  and the initial state; recreating would lose state, so later prop changes flow
  through `setProps`, not a rebuild.
- **keeps props fresh** via a passive effect (`conn.setProps(props)`) — never
  during render (writing the props signal mid-render would loop
  `useSyncExternalStore`). `setProps` value-dedups, so a consumer that rebuilds
  an equal props object each render doesn't churn.
- **runs the lifecycle**: `service.start()` on mount, `service.stop()` on unmount.
  That's all — the connector wired its reactions to the machine's `start`/`stop`,
  so they follow automatically (StrictMode mount→unmount→mount included).
- **drives React** via `useSyncExternalStore(conn.subscribe, () => conn.snapshot)`
  over the connector's stable, memoized snapshot — no infinite-loop / tearing.

Returns `{ api, machine }`: `api` is the connect() output to spread onto
elements; `machine` is the running service (for `useEffects` and `useSelector`).

---

## `useEffects` + `ComponentEffect` — substrate transport, without the boilerplate

Some behavior can't live in the agnostic machine because it needs the **platform
itself** — a DOM `keydown` listener for Escape, a ResizeObserver — and the
**props** the machine never sees (`closeOnEscape`, a prevent-able
`onEscapeKeyDown` veto). That's the component's React-side _effect_.

A component declares it as a **`ComponentEffect`**: a plain setup/teardown
function plus the prop names it depends on. **No React in the component file** —
the generated `useApi` owns the `useEffect`:

```ts
// react/components/tooltip/src/effects.ts
import type { ComponentEffect } from '@render-experiment/machine-react'

export const tooltipEffects: ComponentEffect<TooltipMachine, TooltipMachineProps> = [
  (machine, props) => {
    if (!props.closeOnEscape) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // defer the decision to the agnostic resolver; act on its verdict
      if (resolveEscape({ ...props, state: machine.state }).close) {
        e.stopPropagation()
        machine.send({ type: 'escape' })
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  },
  ['closeOnEscape', 'onEscapeKeyDown'], // ← re-run only when these props change
]
```

The generated `useApi` runs it through `useEffects`, which owns the effect and
builds a **precise dependency array** from the named props:

```ts
useEffects(tooltipEffects, machine, resolved)
//  → useEffect(() => fn(machine, resolved),
//              [machine, resolved.closeOnEscape, resolved.onEscapeKeyDown])
```

Why named deps (not the whole props object): `resolved` is a fresh object every
render, so `[machine, resolved]` would re-run (and re-subscribe the listener)
**every render**. Naming the props — typed `(keyof Props)[]`, so a typo is a
compile error — re-runs the effect _only when one of those values actually
changes_, and never goes stale. `machine` is always an implicit dep.

> The agnostic _decision_ (gate + veto) lives in the core component's resolver
> (`resolveEscape`); only the _transport_ (the DOM listener) is here. Same split
> as everywhere: agnostic policy in core, platform wiring at the edge. The
> machine just receives a plain `escape` event.

---

## `useSelector` — fine-grained leaf subscription

For a leaf component that should re-render only when **one slice** of the machine
changes (not on every machine change) — the `O(readers)` path that matters at
scale (e.g. thousands of menu items, each re-rendering only when _its own_
highlighted state flips):

```ts
const open = useSelector(machine, () => machine.matches('open'))
const isHL = useSelector(machine, () => machine.context.highlightedValue === value)
```

The selector reads from the machine directly, so it auto-subscribes to exactly
the fields it touches; the component re-renders only when the selected value
changes (`Object.is` by default; pass a custom `isEqual` for object selections).

---

## `normalize` — agnostic bindings → DOM props

`connect` returns substrate-agnostic bindings (`onPress`, `describedBy`, `role`).
`normalize` translates them to real DOM/ARIA props (`onClick`,
`aria-describedby`, `role`) so the same `connect` can target DOM, RN, or canvas —
each via its own `normalize`.

```ts
const domProps = normalize(api.parts.trigger) // { onClick, aria-describedby, ... }
```

---

## API

| Export                 | What it is                                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| `useMachine(...)`      | the bridge hook — build + lifecycle + `useSyncExternalStore`; returns `{ api, machine }` |
| `useEffects(effect, machine, props)` | run a `ComponentEffect` as a React effect with a precise dep array |
| `ComponentEffect<M, P>` | `[ (machine, props) => cleanup, (keyof P)[] ]` — a substrate effect + its prop deps |
| `useSelector(machine, selector, isEqual?)` | fine-grained subscription to a derived slice          |
| `normalize(bindings)`  | agnostic bindings → DOM/ARIA props                                          |
| `mergeProps(a, b)`     | merge consumer props with machine props (handlers chained, machine wins)    |
