/**
 * Wire a machine to RN and return a connect() API. The machine is
 * signal-backed (no version counter); we track a local tick bumped by the
 * machine's coarse `subscribe`, which both drives the re-render and keys the
 * api cache. See machine-react's counterpart for the full rationale; this is
 * a near-duplicate so native-specific concerns can land here later.
 */

import { useMemo, useRef, useSyncExternalStore } from 'react'
import { type Connect, type EventObject, type MachineConfig } from '@render-experiment/machine-core'
import { useMachine } from './use-machine'

export function useApi<
  Context extends object,
  Props extends object,
  State,
  Api,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
>(
  config: MachineConfig<Context, Props, Event, Computed>,
  props: Props,
  connect: Connect<State, Context, Props, Api, [], Event, Computed>,
): Api {
  const machine = useMachine<Context, Props, Event, Computed>(config, props)

  const tickRef = useRef(0)
  const tick = useSyncExternalStore(
    onStoreChange =>
      machine.subscribe(() => {
        tickRef.current++
        onStoreChange()
      }),
    () => tickRef.current,
    () => tickRef.current,
  )

  const cacheRef = useRef<{
    machineToken: object
    tick: number
    api: Api
  } | null>(null)

  const machineToken = useMemo(() => ({}), [machine])

  if (
    !cacheRef.current ||
    cacheRef.current.machineToken !== machineToken ||
    cacheRef.current.tick !== tick
  ) {
    cacheRef.current = {
      machineToken,
      tick,
      api: connect({
        state: machine.getState() as State,
        context: machine.getContext(),
        props: machine.getProps(),
        send: machine.send,
        computed: machine.getComputed(),
      })(),
    }
  }

  return cacheRef.current.api
}
