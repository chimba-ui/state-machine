import { useEffect, useMemo, useRef } from 'react'
import {
  createMachine,
  type EventObject,
  type Machine,
  type MachineConfig,
} from '@render-experiment/machine-core'

/**
 * React Native lifecycle bridge for a machine instance.
 *
 * Mirrors the React DOM useMachine (RN uses the same React renderer): create
 * once, start/stop with mount, keep props fresh. Does NOT subscribe for
 * re-renders — `useApi` owns the single coarse subscription, leaves use
 * `useCell`. Kept as a duplicate file so RN-specific concerns can land here.
 */
export function useMachine<
  Context extends object,
  Props extends object,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
>(
  config: MachineConfig<Context, Props, Event, Computed>,
  props: Props,
): Machine<Context, Props, Event, Computed> {
  const configRef = useRef(config)
  const machine = useMemo(
    () => createMachine(configRef.current, props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  machine.setProps(props)

  useEffect(() => {
    machine.start()
    return () => machine.stop()
  }, [machine])

  return machine
}
