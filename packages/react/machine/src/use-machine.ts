import { useEffect, useMemo, useRef } from 'react'
import {
  createMachine,
  type EventObject,
  type Machine,
  type MachineConfig,
} from '@render-experiment/machine-core'

/**
 * React lifecycle bridge for a machine instance.
 *
 * Creates the machine once, starts it on mount, stops it on unmount, and
 * keeps `props` fresh every render (so controlled flags / callbacks / timing
 * read current values inside actions/guards/effects).
 *
 * It does NOT subscribe for re-renders — that's the caller's job. `useApi`
 * owns the single coarse subscription; leaves use `useCell`. (Subscribing
 * here too would double-wake.)
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

  return machine
}
