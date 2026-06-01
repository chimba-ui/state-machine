import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createMachine, type Machine, type MachineConfig } from '@render-experiment/machine-core'

/**
 * React reactivity bridge for a machine instance.
 *
 * Owns the lifecycle (start on mount, stop on unmount) and re-renders via
 * `useSyncExternalStore`, using the machine's monotonic version counter
 * as the snapshot. `Number === Number` is allocation-free and avoids
 * serializing the context on every render.
 *
 * `props` are forwarded every render so controlled-mode flags (`open`),
 * callbacks (`onOpenChange`), and timing knobs (`openDelay`) stay fresh
 * inside actions/guards/effects.
 */
export function useMachine<TContext extends object, TProps extends object>(
  config: MachineConfig<TContext, TProps>,
  props: TProps,
): Machine<TContext, TProps> {
  const configRef = useRef(config)
  const machine = useMemo(
    () => createMachine(configRef.current, props),
    // Machine is created once; subsequent config or props updates flow
    // through setProps below — recreating would lose state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  machine.setProps(props)

  useEffect(() => {
    machine.start()
    return () => machine.stop()
  }, [machine])

  useSyncExternalStore(
    notify => machine.subscribe(notify),
    () => machine.getVersion(),
    () => machine.getVersion(),
  )

  return machine
}
