import { useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  connector,
  machine,
  withAdapter,
  type Adapter,
  type Connect,
  type TransitionConfig,
} from '@render-experiment/machine-core'

/**
 * The one generic React bridge. Every component's generated api.ts calls this
 * with three core pieces — a config factory, the connect, the per-target
 * adapter — plus the resolved props:
 *
 *   useMachine(tooltipMachineConfig, connectTooltip, tooltipAdapter, props)
 *
 * It: builds the machine from props (with the adapter merged in), wraps it in a
 * connector, starts on mount / stops on unmount, keeps props fresh via
 * setProps, and drives React via useSyncExternalStore over the connector's
 * stable snapshot. Returns the connect() api.
 *
 * The machine is built ONCE (from the first render's props); later prop changes
 * flow through setProps — recreating would lose state.
 */
export function useMachine<
  State extends string,
  Context extends object,
  Event extends { type: string },
  Props,
  Api,
  Computed = Record<string, never>,
>(
  createConfig: (props: Props) => TransitionConfig<State, Context, Event, Computed>,
  connect: Connect<State, Context, Event, Props, Api, Computed>,
  adapter: Adapter<Context, Event, Computed>,
  props: Props,
): { api: Api; machine: ReturnType<typeof machine<State, Context, Event, Computed>> } {
  // Build machine + connector once. The first render's props seed context +
  // initial state; the adapter supplies platform effects.
  const { service, conn } = useMemo(
    () => {
      const service = machine(withAdapter(createConfig(props), adapter))
      const conn = connector(service, connect, props)
      return { service, conn }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Keep consumer props fresh every render (controlled flags, callbacks).
  conn.setProps(props)

  // Lifecycle: boot effects on mount, tear down on unmount.
  useEffect(() => {
    service.start()
    return () => {
      conn.dispose()
      service.stop()
    }
  }, [service, conn])

  // Drive re-renders off the connector's stable, memoized snapshot.
  useSyncExternalStore(
    conn.subscribe,
    () => conn.snapshot,
    () => conn.snapshot,
  )

  return { api: conn.snapshot, machine: service }
}
