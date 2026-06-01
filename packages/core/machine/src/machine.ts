import type { ChosenActions, EventObject, MachineConfig, Machine, Transition } from './types'

export function createMachine<
  Context extends object,
  Props extends object,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
>(
  config: MachineConfig<Context, Props, Event, Computed>,
  initialProps: Props,
): Machine<Context, Props, Event, Computed> {
  let props = initialProps

  const initial =
    typeof config.initial === 'function'
      ? (config.initial as (p: Props) => string)(props)
      : config.initial

  const initialContext =
    typeof config.context === 'function'
      ? (config.context as (p: Props) => Context)(props)
      : { ...config.context }

  let state = initial
  let context = initialContext
  let version = 0
  const listeners = new Set<() => void>()
  const effectCleanups = new Map<string, VoidFunction[]>()
  let started = false

  // Computed cache. Recomputed lazily when `cachedComputedVersion` falls
  // behind the live `version`. Empty object when the config has no
  // `computed` block — keeps the param shape consistent for callers.
  let cachedComputed: Computed = {} as Computed
  let cachedComputedVersion = -1
  const computeAll = (): Computed => {
    if (cachedComputedVersion === version) return cachedComputed
    const out = {} as Record<string, unknown>
    if (config.computed) {
      const snap = { state, context, props }
      for (const [key, fn] of Object.entries(config.computed)) {
        out[key] = (fn as (p: typeof snap) => unknown)(snap)
      }
    }
    cachedComputed = out as Computed
    cachedComputedVersion = version
    return cachedComputed
  }

  const notify = () => {
    version++
    listeners.forEach(l => l())
  }

  const setContext = (patch: Partial<Context>) => {
    let changed = false
    for (const key in patch) {
      if (!Object.is(context[key], patch[key])) {
        changed = true
        break
      }
    }
    if (!changed) return
    context = { ...context, ...patch }
    notify()
  }

  /**
   * Dispatch any guard argument — a name or an inline function — against
   * live params. Used by `params.guard()` and by `checkGuard`. Resolving
   * via this single channel means schema-bound combinators
   * (`setup<>().guards.and/or/not`) hit the same registry the runtime
   * does, without leaking it through Params on a private field.
   */
  const resolveGuard = (g: string | ((p: unknown) => boolean), params: unknown): boolean => {
    if (typeof g === 'function') return g(params)
    const fn = config.implementations?.guards?.[g]
    if (!fn) {
      console.warn(`[machine] no guard "${g}"`)
      return false
    }
    return (fn as (p: unknown) => boolean)(params)
  }

  const baseParams = (event: Event) => {
    const params = {
      context,
      setContext,
      props,
      event,
      send,
      computed: computeAll(),
    } as Record<string, unknown>
    params.guard = (g: string | ((p: unknown) => boolean)) => resolveGuard(g, params)
    return params
  }

  const isChosen = (v: unknown): v is ChosenActions =>
    typeof v === 'object' && v !== null && (v as { __choose?: boolean }).__choose === true

  const runActions = (actions: string[] | ChosenActions | undefined, event: Event) => {
    if (!actions) return
    // Expand a choose() sentinel by picking the first matching branch.
    // Guards inside choose use the same checker the runtime uses for
    // transition guards — combinators and inline functions all work.
    const names: string[] = isChosen(actions)
      ? (actions.branches.find(b => checkGuard(b.guard, event))?.actions ?? [])
      : actions
    for (const name of names) {
      const fn = config.implementations?.actions?.[name]
      if (!fn) {
        console.warn(`[machine] no action "${name}"`)
        continue
      }
      fn(baseParams(event) as unknown as Parameters<typeof fn>[0])
    }
  }

  const checkGuard = (guard: Transition['guard'], event: Event): boolean => {
    if (!guard) return true
    // Same params shape user-written guards see — including a `guard()`
    // method that dispatches names or functions through the runtime's
    // single resolution path. Schema-bound combinators
    // (`setup<>().guards.and/or/not`) call `params.guard(x)` and never
    // touch the implementations map directly.
    return resolveGuard(guard as string | ((p: unknown) => boolean), baseParams(event))
  }

  const runEffects = (stateName: string) => {
    const effectNames = config.states[stateName]?.effects
    if (!effectNames) return
    const cleanups: VoidFunction[] = []
    for (const name of effectNames) {
      const fn = config.implementations?.effects?.[name]
      if (!fn) {
        console.warn(`[machine] no effect "${name}"`)
        continue
      }
      const eParams = {
        context,
        setContext,
        props,
        send,
        computed: computeAll(),
      } as Record<string, unknown>
      eParams.guard = (g: string | ((p: unknown) => boolean)) => resolveGuard(g, eParams)
      const cleanup = fn(eParams as unknown as Parameters<typeof fn>[0])
      if (cleanup) cleanups.push(cleanup)
    }
    if (cleanups.length) effectCleanups.set(stateName, cleanups)
  }

  const cleanupEffects = (stateName: string) => {
    const cleanups = effectCleanups.get(stateName)
    cleanups?.forEach(fn => fn())
    effectCleanups.delete(stateName)
  }

  const resolveTransition = (
    transitions: Transition | Transition[] | undefined,
    event: Event,
  ): Transition | undefined => {
    if (!transitions) return undefined
    const list = Array.isArray(transitions) ? transitions : [transitions]
    return list.find(t => checkGuard(t.guard, event))
  }

  const send = (event: Event) => {
    if (!started) return
    const node = config.states[state]
    const transitions = node?.on?.[event.type] ?? config.on?.[event.type]
    const transition = resolveTransition(transitions, event)
    if (!transition) return

    const next = transition.target ?? state
    const changed = next !== state

    if (changed) {
      cleanupEffects(state)
      runActions(node?.exit, event)
    }
    runActions(transition.actions, event)
    if (changed) {
      state = next
      runActions(config.states[next]?.entry, event)
      runEffects(next)
    }
    notify()
  }

  return {
    getState: () => state,
    getContext: () => context,
    getProps: () => props,
    getComputed: () => computeAll(),
    getVersion: () => version,
    setProps(next) {
      props = next
    },
    send,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      if (started) return
      started = true
      // Synthetic boot event for entry actions. Cast because the user's
      // Event union doesn't include it — it's machine-internal.
      runActions(config.states[state]?.entry, { type: '@@start' } as Event)
      runEffects(state)
    },
    stop() {
      if (!started) return
      started = false
      effectCleanups.forEach(cleanups => cleanups.forEach(fn => fn()))
      effectCleanups.clear()
    },
  }
}
