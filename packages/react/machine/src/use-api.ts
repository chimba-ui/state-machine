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

import { useMemo, useRef, useSyncExternalStore } from 'react'
import {
  type Connect,
  type EventObject,
  type Machine,
  type MachineConfig,
} from '@render-experiment/machine-core'
import { useMachine } from './use-machine'

// The api object exposes its machine on a non-enumerable symbol, so leaf
// components can reach the machine for fine-grained `useSelector` without the
// api surface (or the generated useXxxApi return type) changing for anyone.
const MACHINE = Symbol.for('render-experiment.machine')

/** Retrieve the machine attached to an api by `useApi`. */
export function getMachine<M extends Machine<object, object, EventObject, unknown>>(
  api: object,
): M {
  const m = (api as Record<symbol, unknown>)[MACHINE]
  if (!m) throw new Error('getMachine: api was not produced by useApi')
  return m as M
}

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

  // The machine has no version counter; we track a local tick bumped by the
  // machine's coarse `subscribe` (any observable change). useSyncExternalStore
  // both drives the re-render and gives us a stable snapshot to key the cache
  // on, so the api object rebuilds exactly when something changed.
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

  // Cache by (machine instance, tick). A new machine instance can appear
  // after hot-reload or via key-driven remount; the previous cache is dead.
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
    const api = connect({
      state: machine.getState() as State,
      context: machine.getContext(),
      props: machine.getProps(),
      send: machine.send,
      computed: machine.getComputed(),
    })()
    // Attach the machine (non-enumerable) so leaves can `useSelector` over it.
    if (api && typeof api === 'object') {
      Object.defineProperty(api, MACHINE, { value: machine, enumerable: false, configurable: true })
    }
    cacheRef.current = { machineToken, tick, api }
  }

  return cacheRef.current.api
}
