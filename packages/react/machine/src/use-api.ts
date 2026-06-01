/**
 * Wire a machine to React and return a connect() API, cached across
 * renders by the machine's version counter.
 *
 *   export function useTooltipApi(props: TooltipProps): TooltipApi {
 *     return useApi(tooltipMachineWithAdapter, props, connectTooltip);
 *   }
 *
 *
 * Without the cache, every consumer re-render rebuilt the api object
 * (fresh handler closures, fresh attr objects, fresh variants), so
 * children that depend on prop identity always re-rendered. With the
 * cache, the api object is reference-stable until the machine actually
 * transitions or its context changes — exactly when subscribers care.
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

  // Cache by (machine instance, version). A new machine instance can
  // appear after hot-reload or via key-driven remount; in either case
  // the previous cache is dead by definition.
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
