import type { Action, ActionParams } from './types'

/**
 * `act(...)` — the terse spelling of the most common action: write some context.
 *
 * Instead of the full wrapper for a context-only handler:
 *
 *   focus: { actions: [({ setContext }) => setContext({ focused: true })] }
 *
 * write the patch directly:
 *
 *   focus: { actions: [act({ focused: true })] }
 *
 * Two forms: a static patch, or a function of the action params (so the patch
 * can read `event` / `context` / `computed` / `state`):
 *
 *   act({ focused: true })                       // static
 *   act(({ event }) => ({ value: event.value })) // derived from the event
 *   act(({ context }) => ({ n: context.n + 1 }))  // derived from context
 *
 * It returns a normal `Action`, so it composes anywhere actions go — alongside
 * other actions, with a `target`, in any state. Targets stay in the transition
 * object; `act` only ever WRITES (it never moves state).
 */
export function act<Context extends object, Event, Computed = Record<string, never>>(
  patch: Partial<Context> | ((params: ActionParams<Context, Event, Computed>) => Partial<Context>),
): Action<Context, Event, Computed> {
  return params => {
    const next = typeof patch === 'function' ? patch(params) : patch
    params.setContext(next)
  }
}
