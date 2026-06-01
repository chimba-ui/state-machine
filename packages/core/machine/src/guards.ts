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

import type { EventObject, Guard } from './types'

/**
 * Short-circuit AND. Returns true iff every supplied guard passes. With
 * zero arguments returns true (vacuously true — the empty intersection).
 */
export function and<TContext, TProps, TEvent extends EventObject = EventObject>(
  ...guards: Array<Guard<TContext, TProps, TEvent>>
): Guard<TContext, TProps, TEvent> {
  return params => guards.every(g => g(params))
}

/**
 * Short-circuit OR. Returns true iff any supplied guard passes. With zero
 * arguments returns false (vacuously false — the empty union).
 */
export function or<TContext, TProps, TEvent extends EventObject = EventObject>(
  ...guards: Array<Guard<TContext, TProps, TEvent>>
): Guard<TContext, TProps, TEvent> {
  return params => guards.some(g => g(params))
}

/** Logical negation. */
export function not<TContext, TProps, TEvent extends EventObject = EventObject>(
  guard: Guard<TContext, TProps, TEvent>,
): Guard<TContext, TProps, TEvent> {
  return params => !guard(params)
}
