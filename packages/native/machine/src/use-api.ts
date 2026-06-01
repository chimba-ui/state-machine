/**
 * Wire a machine to RN and return a connect() API, cached across
 * renders by the machine's version counter. See machine-react's
 * counterpart for the full rationale; this file is a near-duplicate so
 * native-specific concerns can land here later without coupling.
 */

import { useMemo, useRef } from 'react'
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

  const cacheRef = useRef<{
    machineToken: object
    version: number
    api: Api
  } | null>(null)

  const machineToken = useMemo(() => ({}), [machine])
  const version = machine.getVersion()

  if (
    !cacheRef.current ||
    cacheRef.current.machineToken !== machineToken ||
    cacheRef.current.version !== version
  ) {
    cacheRef.current = {
      machineToken,
      version,
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
