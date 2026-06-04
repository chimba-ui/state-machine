import { useMemo, useRef, useSyncExternalStore } from 'react'
import type { EqualityFn, Machine } from '@render-experiment/machine-core'

/**
 * Fine-grained, selector-based subscription for leaf components.
 *
 * The selector reads from the machine directly (`m.context.x`, `m.matches(...)`)
 * so it auto-subscribes to EXACTLY the fields it touches. The component
 * re-renders only when the selected value changes — not on every machine
 * change. Changing one machine's cell wakes only the components whose selector
 * read that cell (O(readers)).
 *
 *   const open = useSelector(m, () => m.matches('open'))
 *   const hl   = useSelector(m, () => m.context.highlightedValue === value)
 *
 * Equality is `Object.is` by default; pass a custom `isEqual` for object
 * selections.
 */
export function useSelector<
  State extends string,
  Context extends object,
  T,
  Event extends { type: string } = { type: string },
  Computed = Record<string, never>,
>(m: Machine<State, Context, Event, Computed>, selector: () => T, isEqual?: EqualityFn<T>): T {
  // One memoized Selection (a wrapped computed) — auto-tracks the selector's
  // reads, value-deduped via isEqual.
  const sel = useMemo(() => m.select(selector), [m])
  // getSnapshot must be referentially stable between real changes: cache the
  // value and refresh only when the Selection fires.
  const valueRef = useRef<T>(sel.value)
  return useSyncExternalStore(
    onStoreChange =>
      sel.subscribe(next => {
        valueRef.current = next
        onStoreChange()
      }, isEqual),
    () => valueRef.current,
    () => valueRef.current,
  )
}
