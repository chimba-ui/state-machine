/**
 * Round 7c — computed surfaced on the layer (decision 3=A).
 *
 * Pins: m.computed.x is readable directly off the layer (like m.context /
 * m.state), reflects the current derived value, and is a TRACKED read — a
 * preact effect reading it re-runs when an upstream input changes. This is
 * the surface the render loop / connect (R8/R9) will consume.
 */
import { effect } from '@preact/signals-core'
import { describe, expect, it } from 'vitest'
import { machine } from '../src/machine'

describe('R7c — computed on the layer', () => {
  it('exposes m.computed.x reflecting the current derived value', () => {
    const m = machine<'idle', { items: number[] }, { type: 'add' }, { count: number }>({
      initial: 'idle',
      context: { items: [] },
      computed: { count: ({ context }) => context.items.length },
      states: {
        idle: {
          on: {
            add: {
              actions: [({ context, setContext }) => setContext({ items: [...context.items, 1] })],
            },
          },
        },
      },
    })
    expect(m.computed.count).toBe(0)
    m.send({ type: 'add' })
    expect(m.computed.count).toBe(1)
  })

  it('reading m.computed.x is tracked — a preact effect re-runs on change', () => {
    const m = machine<'idle', { n: number }, { type: 'inc' }, { double: number }>({
      initial: 'idle',
      context: { n: 1 },
      computed: { double: ({ context }) => context.n * 2 },
      states: {
        idle: {
          on: { inc: { actions: [({ context, setContext }) => setContext({ n: context.n + 1 })] } },
        },
      },
    })
    const seen: number[] = []
    const dispose = effect(() => {
      seen.push(m.computed.double) // subscribes to the computed signal
    })
    m.send({ type: 'inc' }) // n 1→2 → double 2→4 → effect re-runs
    m.send({ type: 'inc' }) // n 2→3 → double 4→6 → effect re-runs
    dispose()
    m.send({ type: 'inc' }) // disposed → no further pushes
    expect(seen).toEqual([2, 4, 6])
  })

  it('m.computed reflects chained computeds too', () => {
    const m = machine<
      'idle',
      { first: string; last: string },
      { type: 'noop' },
      { full: string; greet: string }
    >({
      initial: 'idle',
      context: { first: 'Ada', last: 'Lovelace' },
      computed: {
        full: ({ context }) => `${context.first} ${context.last}`,
        greet: ({ computed }) => `Hi, ${computed.full}`,
      },
      states: { idle: {} },
    })
    expect(m.computed.full).toBe('Ada Lovelace')
    expect(m.computed.greet).toBe('Hi, Ada Lovelace')
  })
})
