/**
 * Round 8a — coarse subscribe (wake on any change).
 *
 * Pins: subscribe(listener) fires on ANY subsequent state OR context change;
 * does NOT fire on subscribe (decision 3=A); unsubscribe stops it; multiple
 * subscribers each fire; a batched multi-field write coalesces to one fire; a
 * no-op write (value unchanged) does not fire (cell-level Object.is dedup).
 */
import { describe, expect, it, vi } from 'vitest'
import { createTransitions } from '../src/machine'

describe('R8a — coarse subscribe', () => {
  it('does NOT fire on subscribe; fires on a context change', () => {
    const m = createTransitions<'idle', { n: number }, { type: 'inc' }>({
      initial: 'idle',
      context: { n: 0 },
      states: {
        idle: {
          on: { inc: { actions: [({ context, setContext }) => setContext({ n: context.n + 1 })] } },
        },
      },
    })
    const fn = vi.fn()
    m.subscribe(fn)
    expect(fn).not.toHaveBeenCalled() // no fire-on-subscribe
    m.send({ type: 'inc' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('fires on a state change', () => {
    const m = createTransitions<'a' | 'b', object, { type: 'toB' }>({
      initial: 'a',
      context: {},
      states: { a: { on: { toB: { target: 'b' } } }, b: {} },
    })
    const fn = vi.fn()
    m.subscribe(fn)
    m.send({ type: 'toB' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe stops further notifications', () => {
    const m = createTransitions<'idle', { n: number }, { type: 'inc' }>({
      initial: 'idle',
      context: { n: 0 },
      states: {
        idle: {
          on: { inc: { actions: [({ context, setContext }) => setContext({ n: context.n + 1 })] } },
        },
      },
    })
    const fn = vi.fn()
    const unsub = m.subscribe(fn)
    m.send({ type: 'inc' })
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
    m.send({ type: 'inc' })
    expect(fn).toHaveBeenCalledTimes(1) // no more after unsub
  })

  it('multiple subscribers all fire', () => {
    const m = createTransitions<'idle', { n: number }, { type: 'inc' }>({
      initial: 'idle',
      context: { n: 0 },
      states: {
        idle: {
          on: { inc: { actions: [({ context, setContext }) => setContext({ n: context.n + 1 })] } },
        },
      },
    })
    const a = vi.fn()
    const b = vi.fn()
    m.subscribe(a)
    m.subscribe(b)
    m.send({ type: 'inc' })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('a batched multi-field write coalesces to a single notification', () => {
    const m = createTransitions<'idle', { a: number; b: number }, { type: 'both' }>({
      initial: 'idle',
      context: { a: 0, b: 0 },
      states: {
        idle: { on: { both: { actions: [({ setContext }) => setContext({ a: 1, b: 1 })] } } },
      },
    })
    const fn = vi.fn()
    m.subscribe(fn)
    m.send({ type: 'both' }) // setContext batches both cells → one fire
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('a no-op write (unchanged value) does not fire', () => {
    const m = createTransitions<'idle', { n: number }, { type: 'same' }>({
      initial: 'idle',
      context: { n: 5 },
      states: { idle: { on: { same: { actions: [({ setContext }) => setContext({ n: 5 })] } } } },
    })
    const fn = vi.fn()
    m.subscribe(fn)
    m.send({ type: 'same' }) // n 5→5, Object.is equal → cell doesn't change → no fire
    expect(fn).not.toHaveBeenCalled()
  })
})
