import { signal } from '@preact/signals-core'
import type { Connect, Connector, Machine } from './types'

/**
 * Wrap a machine + its pure connect() into a live snapshot. `props` is a
 * reactive input: pass the initial value, push changes via setProps().
 *
 * connect() is a pure mapping (snapshot → view-facing api). The connector is the
 * reactive plumbing that keeps that mapping live: it memoizes connect's output
 * so its identity is stable until inputs change (no useSyncExternalStore
 * infinite loop), reads machine state through live getters (no tearing), makes
 * consumer `props` a reactive input (a props change recomputes the snapshot and
 * wakes subscribers), and is PASSIVE — it forwards subscribe/select but never
 * self-subscribes; the bridge owns lifecycle.
 */
export function connector<
  State extends string,
  Context extends object,
  Event extends { type: string },
  Props,
  Api,
  Computed = Record<string, never>,
>(
  service: Machine<State, Context, Event, Computed>,
  connect: Connect<State, Context, Event, Props, Api, Computed>,
  initialProps: Props,
): Connector<State, Context, Api, Props, Computed> {
  // props as a signal → a props change invalidates the memoized snapshot and
  // trips the coarse subscribe, same as a context/state change.
  const propsSig = signal(initialProps)

  // The snapshot is a memoized Selection over connect's output: its identity is
  // stable until connect's inputs (state/context/computed/props) change.
  const snap = service.select(() =>
    connect({
      get state() {
        return service.state
      },
      get context() {
        return service.context
      },
      get computed() {
        return service.computed
      },
      get props() {
        return propsSig.value
      },
      send: service.send,
    }),
  )

  // Register the component's declared reactions (state-change → prop-callback),
  // ONCE. Each watches its selection (value-deduped) and fires onChange with the
  // current props. Disposed via the connector's dispose().
  const reactionOffs = (connect.reactions ?? []).map(r => {
    const sel = service.select(() => r.select(service))
    return sel.subscribe(value => r.onChange(value, propsSig.value))
  })

  return {
    get snapshot() {
      return snap.value
    },
    // Coarse: wake whenever the snapshot recomputes — i.e. on any state /
    // context / computed / props change (connect returns a fresh object each
    // time, so the Selection's Object.is dedup never suppresses a real change).
    // The value arg is dropped; coarse listeners take none.
    subscribe(listener) {
      return snap.subscribe(() => listener())
    },
    select: service.select,
    setProps(props) {
      propsSig.value = props
    },
    dispose() {
      for (const off of reactionOffs) off()
    },
  }
}
