/**
 * Round 8c — named-scope selection: select.context / .computed / .state.
 *
 * Pins: the typed sugar forms build the same value-deduped Selection as
 * select(fn). select.context(key) → Selection<Context[key]>; select.computed
 * (key) → Selection<Computed[key]>; select.state() → Selection<State>. Each
 * reads/.value and .subscribe with the same semantics as 8b.
 */
import { describe, expect, it, vi } from 'vitest'
import { createTransitions } from '../src/machine'

describe('R8c — select.context / .computed / .state', () => {
  it('select.context(key) selects one field with the exact value type', () => {
    const m = createTransitions<'idle', { x: number; label: string }, { type: 'moveX' | 'moveY' }>({
      initial: 'idle',
      context: { x: 0, label: 'a' },
      states: {
        idle: {
          on: {
            moveX: { actions: [({ context, setContext }) => setContext({ x: context.x + 1 })] },
            moveY: { actions: [({ setContext }) => setContext({ label: 'b' })] },
          },
        },
      },
    })
    const x = m.select.context('x')
    const xv: number = x.value // type: number
    expect(xv).toBe(0)

    const fn = vi.fn()
    x.subscribe(fn)
    m.send({ type: 'moveY' }) // changed `label`, not `x` → x selection silent
    expect(fn).not.toHaveBeenCalled()
    m.send({ type: 'moveX' }) // x 0→1 → fires
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith(1)
  })

  it('select.computed(key) selects a derived value', () => {
    const m = createTransitions<'idle', { items: number[] }, { type: 'add' }, { isEmpty: boolean }>(
      {
        initial: 'idle',
        context: { items: [] },
        computed: { isEmpty: ({ context }) => context.items.length === 0 },
        states: {
          idle: {
            on: {
              add: {
                actions: [
                  ({ context, setContext }) => setContext({ items: [...context.items, 1] }),
                ],
              },
            },
          },
        },
      },
    )
    const isEmpty = m.select.computed('isEmpty')
    const v: boolean = isEmpty.value // type: boolean
    expect(v).toBe(true)

    const fn = vi.fn()
    isEmpty.subscribe(fn)
    m.send({ type: 'add' }) // true→false → fires
    expect(fn).toHaveBeenLastCalledWith(false)
    m.send({ type: 'add' }) // false→false → silent (value-dedup)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('select.state() selects the state string and fires on transitions', () => {
    const m = createTransitions<'a' | 'b' | 'c', object, { type: 'next' }>({
      initial: 'a',
      context: {},
      states: {
        a: { on: { next: { target: 'b' } } },
        b: { on: { next: { target: 'c' } } },
        c: {},
      },
    })
    const state = m.select.state()
    const sv: 'a' | 'b' | 'c' = state.value // type: the State union
    expect(sv).toBe('a')

    const fn = vi.fn()
    state.subscribe(fn)
    m.send({ type: 'next' })
    expect(fn).toHaveBeenLastCalledWith('b')
    m.send({ type: 'next' })
    expect(fn).toHaveBeenLastCalledWith('c')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('select(fn) function form still works alongside the scope methods', () => {
    const m = createTransitions<'idle', { a: number; b: number }, { type: 'go' }>({
      initial: 'idle',
      context: { a: 1, b: 2 },
      states: {
        idle: {
          on: { go: { actions: [({ context, setContext }) => setContext({ a: context.a + 1 })] } },
        },
      },
    })
    const sum = m.select(() => m.context.a + m.context.b)
    expect(sum.value).toBe(3)
    const fn = vi.fn()
    sum.subscribe(fn)
    m.send({ type: 'go' }) // a 1→2 → sum 3→4
    expect(fn).toHaveBeenLastCalledWith(4)
  })
})
