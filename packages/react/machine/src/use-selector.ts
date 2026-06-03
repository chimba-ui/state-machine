import { useRef, useSyncExternalStore } from 'react'
import type { EventObject, Machine } from '@render-experiment/machine-core'

/**
 * Fine-grained, selector-based subscription for leaf components.
 *
 * The selector reads context/state from the machine's tracked snapshot, so it
 * auto-subscribes to EXACTLY the cells (and/or state) it touches. The
 * component re-renders only when the selected value changes — not on every
 * machine change. This is the O(readers) path: in a 5,000-item list, changing
 * one item's cell wakes only the components whose selector read that cell.
 *
 *   const highlighted = useSelector(machine, s => s.context.highlightedValue === value)
 *   const open        = useSelector(machine, s => s.state === 'open')
 *
 * Equality is `Object.is` by default (correct for scalar selections); pass a
 * custom `isEqual` for object selections.
 *
 * Familiar to XState / Zag users: a selector over machine state, not the api.
 */
export function useSelector<
  Context extends object,
  T,
  Event extends EventObject = EventObject,
  Computed = Record<string, never>,
>(
  machine: Machine<Context, object, Event, Computed>,
  selector: (snap: { context: Context; state: string }) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  // Cache the snapshot so getSnapshot is referentially stable between changes
  // (useSyncExternalStore requires it). subscribeSelector only fires when the
  // selected value actually changed, so we refresh on notify.
  const snapRef = useRef<T>(machine.select(selector))
  return useSyncExternalStore(
    onStoreChange =>
      machine.subscribeSelector(
        selector,
        () => {
          snapRef.current = machine.select(selector)
          onStoreChange()
        },
        isEqual,
      ),
    () => snapRef.current,
    () => snapRef.current,
  )
}
