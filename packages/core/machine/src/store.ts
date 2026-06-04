import { effect, signal } from '@preact/signals-core'

/**
 * A tiny signal-backed reactive store — for cross-instance singleton state
 * (e.g. "only one tooltip open at a time") that lives outside any single
 * machine.
 *
 * Signal-backed (not a listener Set) so the value composes with the engine's
 * reactivity: reading `get()` inside a machine `select`/effect tracks it.
 *
 * The base always carries `get` / `set` / `subscribe`. Pass a second `build`
 * arg to add named domain methods on top — no facade boilerplate:
 *
 *   const tooltipStore = createStore(
 *     { openId: null as string | null },
 *     (s) => ({
 *       setOpen: (id: string | null) => s.set({ openId: id }),
 *       isOpen: (id: string) => s.get().openId === id,
 *     }),
 *   )
 *   tooltipStore.get() / .subscribe(fn) / .setOpen('a') / .isOpen('a')
 */
export type Listener<T> = (state: T) => void
export type SetStateAction<T> = Partial<T> | ((state: T) => Partial<T>)

export interface Store<T extends object> {
  /** Current value. A tracked read inside a reactive scope. */
  get: () => T
  /** Shallow-merge a patch (or an updater) over the current value. */
  set: (action: SetStateAction<T>) => void
  /** Fire on every subsequent change (not on subscribe). Bare unsubscribe. */
  subscribe: (listener: Listener<T>) => () => void
}

export function createStore<T extends object, Methods extends object = object>(
  initial: T,
  build: (store: Store<T>) => Methods = () => ({}) as Methods,
): Store<T> & Methods {
  const state = signal<T>(initial)
  const base: Store<T> = {
    get: () => state.value,
    set(action) {
      const patch = typeof action === 'function' ? action(state.value) : action
      state.value = { ...state.value, ...patch }
    },
    subscribe(listener) {
      let primed = false
      return effect(() => {
        const s = state.value
        if (primed) listener(s)
        else primed = true
      })
    },
  }
  return { ...base, ...build(base) }
}
