/**
 * Guard combinators — compose transition guards without naming a new one
 * for every combination.
 *
 *   guard: 'shouldClose'                              // single named guard
 *   guard: ({ context }) => context.x > 0             // raw inline function
 *   guard: and(isOpen, not(isAnimating))              // composed inline
 *
 * Combinators only accept functions (not names). To use a named guard
 * inside a combinator, hoist its implementation to a top-level function
 * and pass that.
 *
 * Each combinator returns a Guard function that the machine runtime calls
 * the same way it calls any other guard — same Params, same return shape.
 * Compose arbitrarily deep.
 */

import type { ChooseBranch, ChosenActions, EventObject, Guard } from './types'

/**
 * Short-circuit AND. Returns true iff every supplied guard passes. With
 * zero arguments returns true (vacuously true — the empty intersection).
 */
export function and<Context, Props, Event extends EventObject = EventObject>(
  ...guards: Array<Guard<Context, Props, Event>>
): Guard<Context, Props, Event> {
  return params => guards.every(g => g(params))
}

/**
 * Short-circuit OR. Returns true iff any supplied guard passes. With zero
 * arguments returns false (vacuously false — the empty union).
 */
export function or<Context, Props, Event extends EventObject = EventObject>(
  ...guards: Array<Guard<Context, Props, Event>>
): Guard<Context, Props, Event> {
  return params => guards.some(g => g(params))
}

/** Logical negation. */
export function not<Context, Props, Event extends EventObject = EventObject>(
  guard: Guard<Context, Props, Event>,
): Guard<Context, Props, Event> {
  return params => !guard(params)
}

/**
 * Pick one action list out of several at runtime. Each branch declares an
 * optional `guard` and a list of action names; the first branch whose
 * guard returns true (or the first guardless branch) wins. Use inside a
 * transition's `actions` field:
 *
 *   on: {
 *     escape: {
 *       actions: choose([
 *         { guard: 'isFocusTrap', actions: ['flashWarning'] },
 *         { actions: ['invokeOnClose'] },
 *       ]),
 *       target: 'closed',
 *     },
 *   }
 *
 * Returns a sentinel object the runtime detects and expands. Combinators
 * (`and / or / not`) work as the `guard` field, same as on transitions.
 */
export function choose(branches: ChooseBranch[]): ChosenActions {
  return { __choose: true, branches }
}
