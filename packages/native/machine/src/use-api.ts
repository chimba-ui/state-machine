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
  TContext extends object,
  TProps extends object,
  TState,
  TApi,
  TEvent extends EventObject = EventObject,
>(
  config: MachineConfig<TContext, TProps, TEvent>,
  props: TProps,
  connect: Connect<TState, TContext, TProps, TApi, [], TEvent>,
): TApi {
  const machine = useMachine<TContext, TProps, TEvent>(config, props)

  const cacheRef = useRef<{
    machineToken: object
    version: number
    api: TApi
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
        state: machine.getState() as TState,
        context: machine.getContext(),
        props: machine.getProps(),
        send: machine.send,
      })(),
    }
  }

  return cacheRef.current.api
}
