/**
 * Machine engine — rebuilt from scratch, one decision at a time.
 *
 * Reactivity kernel: @preact/signals-core (locked decision).
 *
 * ROUND 1 — Context layer (DECIDED):
 *   - Each context field is its own signal ("cell").
 *   - Reads are plain, tracked property access: `context.field`
 *     (a getter that reads the cell's signal → auto-subscribes the reader).
 *   - Writes go through one explicit, batched entry point:
 *     `setContext({ field: value })`.
 *   This mirrors Solid's store split (plain tracked reads, explicit writes)
 *   — no assignment-reactive footgun, no per-cell .get()/.set() ceremony.
 *
 * Everything below this layer (state, transitions, guards, actions, effects,
 * computed, subscription, connect) is STUBBED and will be built in later
 * rounds. The build is intentionally incomplete until then.
 */

import { batch, signal, type Signal } from '@preact/signals-core'

// -----------------------------------------------------------------------------
// Round 1: context layer
// -----------------------------------------------------------------------------

/**
 * Build the reactive context from a plain initial object.
 *
 * Returns:
 *   - `context`: a read view. `context.field` is a getter over the field's
 *     signal — reading it inside a tracked scope (effect/computed) subscribes
 *     the reader to just that field.
 *   - `setContext(patch)`: the single write entry point. Batched so a
 *     multi-field patch notifies each subscriber at most once; signals' own
 *     Object.is skips no-op writes.
 *
 * The setup loop runs once per machine (never on read/write), so per-read cost
 * is a plain accessor — no Proxy.
 */
export function createContext<Context extends object>(
  initial: Context,
): {
  context: Context
  setContext: (patch: Partial<Context>) => void
} {
  const cells = {} as { [K in keyof Context]: Signal<Context[K]> }
  const context = {} as Context

  for (const key in initial) {
    const k = key as keyof Context
    const cell = signal(initial[k])
    cells[k] = cell
    Object.defineProperty(context, k, {
      get: () => cell.value,
      enumerable: true,
      configurable: false,
    })
  }

  const setContext = (patch: Partial<Context>) => {
    batch(() => {
      for (const key in patch) {
        const cell = cells[key as keyof Context]
        if (cell) cell.value = patch[key as keyof Context]!
      }
    })
  }

  return { context, setContext }
}

// -----------------------------------------------------------------------------
// Round 2: state representation (DECIDED)
// -----------------------------------------------------------------------------
//
// Flat tagged states (the "G" decision: flat per machine, composition for
// hierarchy/parallelism later). One active state, a plain string. States
// declare `tags` co-located on the node. Read surface:
//   - `state`            tracked current state string
//   - `hasTag(tag)`      tracked — is the current state tagged `tag`?
//   - `matches(name)`    tracked — is the current state exactly `name`?
// All three are tracked signal reads (reading inside an effect/computed
// subscribes the reader), matching Round 1's context model.
//
// This layer owns ONLY representation + reads. Moving between states
// (transitions) is Round 3.

/** Per-state node. `tags` groups states so consumers query a tag, not names. */
export interface StateNode {
  tags?: string[]
}

export interface State<T extends string> {
  /** Tracked current state. */
  readonly state: T
  /** Tracked: is the current state tagged `tag`? */
  hasTag: (tag: string) => boolean
  /** Tracked: is the current state exactly `name`? (sugar for state === name) */
  matches: (name: T) => boolean
  /**
   * Move to a new state. INTERNAL to the engine: the transition layer
   * (Round 3) calls this; the assembled machine does NOT forward it to
   * consumers (who move state only via `send`). Privacy is structural — the
   * public machine simply won't expose `set` — not by naming convention.
   */
  set: (next: T) => void
}

export function createState<T extends string>(initial: T, nodes: Record<T, StateNode>): State<T> {
  const stateSig = signal<T>(initial)

  // Precompute each state's tag set once (lookup is per-read, must be cheap).
  const tagsOf = {} as Record<T, ReadonlySet<string>>
  for (const name in nodes) {
    tagsOf[name as T] = new Set(nodes[name as T].tags ?? [])
  }

  return {
    get state() {
      return stateSig.value // tracked read
    },
    hasTag(tag: string) {
      return tagsOf[stateSig.value].has(tag) // reads stateSig → tracked
    },
    matches(name: T) {
      return stateSig.value === name // reads stateSig → tracked
    },
    set(next: T) {
      stateSig.value = next // Object.is dedup is built into the signal
    },
  }
}

// -----------------------------------------------------------------------------
// Round 3: transitions (DECIDED)
// -----------------------------------------------------------------------------
//
// send(event) moves the machine. Decisions:
//   3a Events are { type, ...payload } discriminated unions.
//   3b Transitions live in each state's `on`, with an optional top-level `on`
//      for any-state events. Per-state wins over top-level.
//   3c An event maps to one transition OR an array (guard fallthrough: first
//      whose guard passes wins). Self-transitions (no `target`, or same state)
//      run actions but SKIP exit/entry (internal only).
//   3d send() is QUEUED: a send() called during a transition is enqueued and
//      processed after the current one fully completes (exit→actions→switch→
//      entry). No re-entrancy corruption; events process serially.
//
// Transition sequence on a state change:
//   exit actions (old state) → transition actions → switch state →
//   entry actions (new state).
//
// NOTE: guard + action RESOLUTION (how a name/fn becomes a result) is wired
// minimally here and formalized in Round 4 (guards) and Round 5 (actions).
// This round owns the transition mechanics + the queue, not those registries.

// -----------------------------------------------------------------------------
// Round 4a: guards — params shape + inline guards (DECIDED)
// -----------------------------------------------------------------------------
//
// A guard is a predicate gating a transition. It receives the FINAL params
// shape now — { context, event, computed } — even though `computed` is wired
// in Round 7; until then it's an empty object. Locking the shape here means no
// guard signature churns later. Named guards (4b) and combinators (4c) build
// on this same Guard type.

/** Everything a guard can read. `computed` is `{}` until Round 7 wires it. */
export interface GuardParams<Context, Event, Computed = Record<string, never>> {
  context: Context
  event: Event
  computed: Computed
}

/** An inline guard: a predicate over the params. */
export type Guard<Context, Event, Computed = Record<string, never>> = (
  params: GuardParams<Context, Event, Computed>,
) => boolean

/** A single transition: optional target, optional guard, optional actions. */
export interface Transition<
  State extends string,
  Context,
  Event,
  Computed = Record<string, never>,
> {
  target?: State
  /** Inline predicate. Named guards + combinators (4b/4c) extend this. */
  guard?: Guard<Context, Event, Computed>
  /** Inline action list for now; named actions + choose are Round 5. */
  actions?: Array<(params: TransitionActionParams<Context, Event>) => void>
}

/** Params an action receives during a transition. `send` here is queued. */
export interface TransitionActionParams<Context, Event> {
  context: Context
  setContext: (patch: Partial<Context>) => void
  event: Event
  send: (event: Event) => void
}

type TransitionEntry<State extends string, Context, Event, Computed> =
  | Transition<State, Context, Event, Computed>
  | Array<Transition<State, Context, Event, Computed>>

export interface TransitionConfig<
  State extends string,
  Context,
  Event extends { type: string },
  Computed = Record<string, never>,
> {
  initial: State
  context: Context
  states: Record<
    State,
    StateNode & { on?: Record<string, TransitionEntry<State, Context, Event, Computed>> }
  >
  /** Any-state events. Per-state `on` takes precedence over this. */
  on?: Record<string, TransitionEntry<State, Context, Event, Computed>>
}

export interface TransitionLayer<State extends string, Context, Event extends { type: string }> {
  readonly state: State
  hasTag: (tag: string) => boolean
  matches: (name: State) => boolean
  readonly context: Context
  send: (event: Event) => void
}

/**
 * Round 3 building block: state + context + queued, guarded transitions.
 *
 * NOT the machine — a composable layer. `createMachine` (the single public
 * factory) is assembled from these pieces in the final round. Guards and
 * actions are inline functions for now (named registries arrive in R4/R5).
 */
export function createTransitions<
  State extends string,
  Context extends object,
  Event extends { type: string },
  Computed = Record<string, never>,
>(
  config: TransitionConfig<State, Context, Event, Computed>,
): TransitionLayer<State, Context, Event> {
  const st = createState<State>(config.initial, config.states)
  const { context, setContext } = createContext<Context>(config.context)

  // `computed` is wired in Round 7; until then it's an empty object so the
  // guard params shape is already final.
  const computed = {} as Computed

  // 3c: resolve an entry (single or array) to the first transition whose
  // guard passes. No guard = always passes. Guards get { context, event,
  // computed } (4a).
  const resolve = (
    entry: TransitionEntry<State, Context, Event, Computed> | undefined,
    event: Event,
  ) => {
    if (!entry) return undefined
    const list = Array.isArray(entry) ? entry : [entry]
    return list.find(t => (t.guard ? t.guard({ context, event, computed }) : true))
  }

  // 3d: the queue. send() enqueues; the first send drains the queue, so a
  // re-entrant send (from an action) waits until the current transition ends.
  const queue: Event[] = []
  let draining = false

  const runActions = (actions: Transition<State, Context, Event>['actions'], event: Event) => {
    if (!actions) return
    for (const action of actions) action({ context, setContext, event, send })
  }

  const send = (event: Event) => {
    queue.push(event)
    if (draining) return
    draining = true
    try {
      while (queue.length) {
        const e = queue.shift()!
        // 3b: per-state `on` first, then top-level `on`.
        const entry = config.states[st.state].on?.[e.type] ?? config.on?.[e.type]
        const t = resolve(entry, e)
        if (!t) continue
        const cur = st.state
        const next = t.target ?? cur
        const changed = next !== cur
        // 3c: internal self-transition runs actions only, skips exit/entry.
        if (changed) runExit(cur, e)
        runActions(t.actions, e)
        if (changed) {
          st.set(next)
          runEntry(next, e)
        }
      }
    } finally {
      draining = false
    }
  }

  // entry/exit action hooks — Round 5 formalizes these (named lists on the
  // state node). For now they're no-ops; transition `actions` carry behavior.
  const runEntry = (_state: State, _event: Event) => {}
  const runExit = (_state: State, _event: Event) => {}

  return {
    get state() {
      return st.state
    },
    hasTag: st.hasTag,
    matches: st.matches,
    get context() {
      return context
    },
    send,
  }
}

// -----------------------------------------------------------------------------
// STUBS — to be designed in later rounds. Not wired, not final.
// -----------------------------------------------------------------------------
//
// Round 4: guards (and/or/not — kept concept)
// Round 5: actions (+ choose, + entry/exit lists — kept concept)
// Round 6: effects (+ adapter injection — kept concept)
// Round 7: computed (kept concept)
// Round 8: subscription surface (subscribe / subscribeSelector / select)
// Round 9: connect / connector boundary (kept concept)
//
// `createMachine` (the SINGLE public factory) is assembled from these
// composable pieces — createContext, createState, createTransitions, … — in
// the final round. None of the per-round building blocks is named `*Machine`.
