import { useRef, useSyncExternalStore } from 'react'
import type { EventObject, Machine } from '@render-experiment/machine-core'

/**
 * Fine-grained, selector-based subscription for leaf components (RN).
 *
 * Mirror of machine-react's useSelector. The selector reads context/state via
 * the machine's tracked snapshot and auto-subscribes to exactly what it
 * touches; the component re-renders only when the selected value changes — the
 * O(readers) path for large lists.
 *
 *   const highlighted = useSelector(machine, s => s.context.highlightedValue === value)
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
