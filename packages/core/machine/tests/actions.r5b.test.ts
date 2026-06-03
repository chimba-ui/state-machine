/**
 * Round 5b — named actions.
 *
 * Pins: an `actions` entry may be a registered NAME (resolved against
 * implementations.actions) or an inline fn; names + inline coexist in one
 * list and run in order; a missing name throws in dev.
 */
import { describe, expect, it } from 'vitest'
import { machine } from '../src/machine'

describe('R5b — named actions', () => {
  it('resolves actions by name from implementations.actions', () => {
    const m = machine<'idle', { n: number }, { type: 'go' }>({
      initial: 'idle',
      context: { n: 0 },
      states: { idle: { on: { go: { actions: ['inc', 'inc'] } } } },
      implementations: {
        actions: { inc: ({ context, setContext }) => setContext({ n: context.n + 1 }) },
      },
    })
    m.send({ type: 'go' })
    expect(m.context.n).toBe(2)
  })

  it('named and inline actions coexist and run in order', () => {
    const order: string[] = []
    const m = machine<'idle', object, { type: 'go' }>({
      initial: 'idle',
      context: {},
      states: {
        idle: { on: { go: { actions: ['first', () => order.push('inline'), 'last'] } } },
      },
      implementations: {
        actions: {
          first: () => order.push('first'),
          last: () => order.push('last'),
        },
      },
    })
    m.send({ type: 'go' })
    expect(order).toEqual(['first', 'inline', 'last'])
  })

  it('throws in dev when an action name is not registered', () => {
    const m = machine<'idle', object, { type: 'go' }>({
      initial: 'idle',
      context: {},
      states: { idle: { on: { go: { actions: ['missing'] } } } },
    })
    expect(() => m.send({ type: 'go' })).toThrow(/no action "missing"/)
  })
})
