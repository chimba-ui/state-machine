import { useEffect } from 'react'

/**
 * A component's substrate-specific effect, declared as a plain
 * setup/teardown function plus the prop names it depends on:
 *
 *   const tooltipEffects: ComponentEffect<TooltipMachine, TooltipMachineProps> = [
 *     (machine, props) => { ...addEventListener...; return () => ...remove... },
 *     ['closeOnEscape', 'onEscapeKeyDown'], // re-run when these props change
 *   ]
 *
 * The author writes no React. The generated `useApi` runs it through
 * `useEffects`, which owns the `useEffect` and builds a precise dependency array
 * from the named props (so it re-subscribes only when one of them actually
 * changes — not every render, not stale). `machine` is always an implicit dep.
 */
export type ComponentEffect<Machine, Props> = [
  effect: (machine: Machine, props: Props) => (() => void) | void,
  deps: (keyof Props)[],
]

/**
 * Run a `ComponentEffect` as a React effect. The dependency array is
 * `[machine, ...the named prop values]`, so the effect re-runs exactly when the
 * machine instance or one of its declared props changes.
 */
export function useEffects<Machine, Props>(
  effect: ComponentEffect<Machine, Props> | undefined,
  machine: Machine,
  props: Props,
): void {
  const fn = effect?.[0]
  const deps = effect?.[1] ?? []
  useEffect(
    () => (fn ? fn(machine, props) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machine, ...deps.map(k => props[k])],
  )
}
