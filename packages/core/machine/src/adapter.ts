/**
 * Adapter — substrate-specific effect implementations supplied to a machine.
 *
 * The host (the core machine) declares effects by name. Some effects can
 * only be implemented per-substrate (DOM listeners, RN BackHandler,
 * NSEvent on macOS, …). The pattern:
 *
 *   1. Host (core) declares the effect by name as a no-op placeholder.
 *   2. Each adapter (React DOM, React Native, …) provides a real
 *      implementation in its own adapter.ts file.
 *   3. The adapter package's generated api.ts wraps the machine config
 *      via `withAdapter(config, adapter)` before useMachine.
 *
 * This keeps each component's core free of substrate-specific code while
 * letting each adapter wire in the runtime behavior native to its
 * platform.
 */

import type { Effect, EventObject, MachineConfig } from './types'

export type Adapter<
  TContext,
  TProps,
  TEvent extends EventObject = EventObject,
  TComputed = Record<string, never>,
> = Record<string, Effect<TContext, TProps, TEvent, TComputed>>

/**
 * Return a copy of `config` with the adapter's effect implementations
 * merged in. Effects with the same name in `adapter` override the
 * host's placeholder.
 *
 * Unknown effect names in the adapter map trigger a warning — likely a
 * rename in core that the adapter file hasn't caught up with.
 */
export function withAdapter<
  TContext,
  TProps,
  TEvent extends EventObject = EventObject,
  TComputed = Record<string, never>,
>(
  config: MachineConfig<TContext, TProps, TEvent, TComputed>,
  adapter: Adapter<TContext, TProps, TEvent, TComputed>,
): MachineConfig<TContext, TProps, TEvent, TComputed> {
  const existing = config.implementations?.effects ?? {}
  const merged: Record<string, Effect<TContext, TProps, TEvent, TComputed>> = { ...existing }
  for (const [name, fn] of Object.entries(adapter)) {
    if (!(name in existing)) {
      console.warn(`[machine] adapter effect "${name}" not declared in host; using it anyway`)
    }
    merged[name] = fn
  }
  return {
    ...config,
    implementations: {
      ...config.implementations,
      effects: merged,
    },
  }
}
