/**
 * Tiny reactive container.
 *
 * A mutable value, a set of listeners, notify on every change.
 * Components compose this with their own typed operations on top.
 *
 * Intentionally small. If you find yourself wanting selectors,
 * derived stores, transactions, equality checks, etc., you're
 * crossing into "small state library" territory — that's a
 * different project.
 */

export interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
