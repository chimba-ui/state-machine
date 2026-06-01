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

  // Cache by (machine instance, version). A new machine instance can
  // appear after hot-reload or via key-driven remount; in either case
  // the previous cache is dead by definition.
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
