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
export function createContext<C extends object>(
  initial: C,
): {
  context: C
  setContext: (patch: Partial<C>) => void
} {
  const cells = {} as { [K in keyof C]: Signal<C[K]> }
  const context = {} as C

  for (const key in initial) {
    const k = key as keyof C
    const cell = signal(initial[k])
    cells[k] = cell
    Object.defineProperty(context, k, {
      get: () => cell.value,
      enumerable: true,
      configurable: false,
    })
  }

  const setContext = (patch: Partial<C>) => {
    batch(() => {
      for (const key in patch) {
        const cell = cells[key as keyof C]
        if (cell) cell.value = patch[key as keyof C]!
      }
    })
  }

  return { context, setContext }
}

// -----------------------------------------------------------------------------
// STUBS — to be designed in later rounds. Not wired, not final.
// -----------------------------------------------------------------------------
//
// Round 2: state representation
// Round 3: transitions
// Round 4: guards (and/or/not — kept concept)
// Round 5: actions (+ choose — kept concept)
// Round 6: effects (+ adapter injection — kept concept)
// Round 7: computed (kept concept)
// Round 8: subscription surface (subscribe / subscribeSelector / select)
// Round 9: connect / connector boundary (kept concept)
//
// `createMachine` will be reassembled from these once each is decided.
