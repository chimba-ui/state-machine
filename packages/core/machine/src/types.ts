/**
 * Machine DSL — a Zag-shaped library with NO substrate assumptions.
 *
 * A machine config is data: states, events, transitions, named guards/actions/effects.
 * The `connect` output is LOGICAL: no `onClick`, no `aria-*`, no `style`, no `data-*`.
 * Target adapters translate that logical surface to a specific renderer.
 */

import type { AttrBindings, EventBindings } from './bindings'

/**
 * Base event shape. Components declare their own discriminated-union
 * `Event` extending this — `{ type: 'item.click'; value: string; ... }`
 * etc — and pass it as the third generic to `MachineConfig` / `Machine`.
 *
 * Action / guard bodies then get a fully-typed `event` parameter, and
 * `send()` call sites are type-checked. The default keeps non-opted-in
 * callers working with a payload-free event.
 */
export type EventObject = { type: string }

export interface Params<
  Context,
  Props,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
> {
  context: Context
  setContext: (patch: Partial<Context>) => void
  props: Props
  event: Event
  send: (event: Event) => void
  /**
   * Derived values declared via `computed: { ... }` on the machine config.
   * Recomputed lazily when the machine's version bumps; cached otherwise.
   * Empty object `{}` when no computed declared.
   */
  computed: Computed
  /**
   * Dispatch any guard argument — a name from `implementations.guards`
   * or an inline `Guard` function — against the live params. Returns
   * the boolean the guard yields. Used by `setup<>().guards.and/or/not`
   * to resolve composed guards against the same registry the runtime
   * uses; available to user-written guards / actions / effects that
   * need to consult another named guard.
   */
  guard: (g: string | Guard<Context, Props, Event, Computed>) => boolean
}

export type Action<
  Context,
  Props,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
> = (params: Params<Context, Props, Event, Computed>) => void

export type Guard<
  Context,
  Props,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
> = (params: Omit<Params<Context, Props, Event, Computed>, 'send' | 'setContext'>) => boolean

/**
 * What a transition's `guard` field accepts: a name (resolved against
 * `implementations.guards`), an inline function, or a combinator (and / or /
 * not) — itself just a Guard function. Same shape composes arbitrarily.
 */
export type GuardArg<
  Context = unknown,
  Props = unknown,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
> = string | Guard<Context, Props, Event, Computed>

export type Effect<
  Context,
  Props,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
> = (params: Omit<Params<Context, Props, Event, Computed>, 'event'>) => VoidFunction | void

/**
 * One computed value's definition: a function over the snapshot that
 * returns the derived value. The runtime evaluates it lazily and caches
 * by machine version.
 */
export type ComputedFn<Context, Props, Value> = (params: {
  state: string
  context: Context
  props: Props
}) => Value

/**
 * One branch of a `choose([...])` block: optional guard, an action list
 * to run when the guard matches (or it's the catch-all). First branch
 * whose guard returns true wins; later branches are skipped.
 */
export interface ChooseBranch {
  guard?: GuardArg
  actions: string[]
}

/**
 * A `choose(...)` sentinel — a tagged object the runtime detects in
 * `transition.actions` and expands by picking the first matching branch.
 * Authored via the `choose()` helper exported from this package; users
 * never construct it by hand.
 */
export interface ChosenActions {
  readonly __choose: true
  readonly branches: ChooseBranch[]
}

export interface Transition {
  target?: string
  /**
   * Either a name (resolved against `implementations.guards`) or an
   * inline function. Compose with `and / or / not`.
   */
  guard?: GuardArg
  /**
   * Either a list of named actions to run unconditionally, or a
   * `choose([...])` sentinel that picks one branch at runtime.
   */
  actions?: string[] | ChosenActions
}

export interface StateNode {
  entry?: string[]
  exit?: string[]
  effects?: string[]
  on?: Record<string, Transition | Transition[]>
}

export interface MachineConfig<
  Context,
  Props = Record<string, unknown>,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
> {
  initial: string | ((props: Props) => string)
  context: Context | ((props: Props) => Context)
  states: Record<string, StateNode>
  on?: Record<string, Transition | Transition[]>
  /**
   * Derived values, evaluated lazily and memoized by machine version.
   * Each key maps to a function over the snapshot. Available to actions,
   * guards, effects, and the connect via `params.computed`.
   */
  computed?: {
    [K in keyof Computed]: ComputedFn<Context, Props, Computed[K]>
  }
  implementations?: {
    actions?: Record<string, Action<Context, Props, Event, Computed>>
    guards?: Record<string, Guard<Context, Props, Event, Computed>>
    effects?: Record<string, Effect<Context, Props, Event, Computed>>
  }
}

/**
 * Part — the shape of a single named slice on a connect() API.
 *
 * Every component's connect output groups its rendered surfaces under
 * `api.parts`. Each part has, at minimum, a `handlers` bag (events the
 * adapter wires up) and an `attrs` bag (attributes the adapter applies).
 *
 * Most parts also expose:
 *   - `variants`: the cross-substrate styling variant prop set, computed
 *     in the connect from state + props so adapters don't re-derive.
 *   - extras: positioning, rendered flag, anything component-specific.
 *
 * The two generics are independent on purpose:
 *
 *   Part                       — handlers + attrs only
 *   Part<MyVariants>           — adds typed variants
 *   Part<MyVariants, MyExtras> — adds typed extras (e.g., positioning)
 *
 * Authors who don't need variants still benefit from the typing: a
 * Separator's part is just `Part` (no variants, no extras).
 */
export type Part<Variants extends object = never, Extras extends object = never> = {
  handlers: EventBindings
  attrs: AttrBindings
} & ([Variants] extends [never] ? unknown : { variants: Variants }) &
  ([Extras] extends [never] ? unknown : Extras)

export interface Machine<
  Context,
  Props = Record<string, unknown>,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
> {
  getState: () => string
  getContext: () => Context
  getProps: () => Props
  /** Latest computed values; cached by version, recomputed on first read after a bump. */
  getComputed: () => Computed
  /**
   * Monotonic counter that bumps on every state transition or context
   * change. Designed as a cheap "did anything change?" snapshot for
   * subscribers like React's useSyncExternalStore.
   */
  getVersion: () => number
  setProps: (next: Props) => void
  send: (event: Event) => void
  subscribe: (listener: () => void) => () => void
  start: () => void
  stop: () => void
}
