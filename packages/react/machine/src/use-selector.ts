import { useMemo, useRef, useSyncExternalStore } from 'react'
import type { EqualityFn, Machine } from '@render-experiment/machine-core'

/**
 * Fine-grained, selector-based subscription for leaf components.
 *
 * The selector reads from the machine directly (`m.context.x`, `m.matches(...)`)
 * so it auto-subscribes to EXACTLY the fields it touches. The component
 * re-renders only when the selected value changes — not on every machine
 * change. Changing one machine's cell wakes only the components whose selector
 * read that cell (O(readers)) — the path that makes thousands of leaf items
 * (each subscribing to its own slice) cheap.
 *
 *   const open = useSelector(m, () => m.matches('open'))
 *   const isHL = useSelector(m, () => m.context.highlightedValue === value)
 *
 * Equality is `Object.is` by default; pass a custom `isEqual` for object
 * selections.
 *
 * The selector and isEqual are kept in refs and read through a STABLE inner
 * Selection, so a per-render-fresh `selector` (e.g. one closing over a `value`
 * prop) always evaluates its latest form WITHOUT re-creating the Selection or
 * re-subscribing every render. Only `m` changing rebuilds the subscription.
 */
export function useSelector<
  State extends string,
  Context extends object,
  T,
  Event extends { type: string } = { type: string },
  Computed = Record<string, never>,
>(
  machine: Machine<State, Context, Event, Computed>,
  selector: () => T,
  isEqual?: EqualityFn<T>,
): T {
  // Always evaluate the LATEST selector / equality, without making them deps of
  // the Selection (which would rebuild + re-subscribe on every render, since a
  // leaf typically passes a fresh closure each time).
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  const isEqualRef = useRef(isEqual)
  isEqualRef.current = isEqual

  // One Selection over a stable wrapper that reads the current selector. Built
  // once per machine; auto-tracks whatever the selector reads, value-deduped.
  // `sel.value` re-reads the wrapper, so it always reflects the LATEST selector
  // (e.g. after a `value` prop change) — getSnapshot stays correct without
  // rebuilding the Selection or re-subscribing.
  const selectorMemo = useMemo(() => machine.select(() => selectorRef.current()), [machine])

  return useSyncExternalStore(
    onStoreChange => selectorMemo.subscribe(() => onStoreChange(), isEqualRef.current),
    () => selectorMemo.value,
    () => selectorMemo.value,
  )
}
