/**
 * Round 4b — named guards.
 *
 * Pins: a transition `guard` may be a registered NAME (resolved against
 * implementations.guards) or an inline fn; a missing name throws in dev.
 */
import { describe, expect, it } from 'vitest'
import { createTransitions } from '../src/machine'

describe('R4b — named guards', () => {
  it('resolves a guard by name from implementations.guards', () => {
    const m = createTransitions<'idle', { allow: boolean }, { type: 'go' }>({
      initial: 'idle',
      context: { allow: true },
      states: {
        idle: {
          on: {
            go: { guard: 'isAllowed', actions: [({ setContext }) => setContext({ allow: false })] },
          },
        },
      },
      implementations: {
        guards: { isAllowed: ({ context }) => context.allow },
      },
    })
    m.send({ type: 'go' }) // isAllowed true → runs
    expect(m.context.allow).toBe(false)
    m.send({ type: 'go' }) // isAllowed false → blocked
    expect(m.context.allow).toBe(false)
  })

  it('named and inline guards coexist (fallthrough array)', () => {
    const m = createTransitions<'idle', { n: number }, { type: 'tick' }>({
      initial: 'idle',
      context: { n: 0 },
      states: {
        idle: {
          on: {
            tick: [
              { guard: 'never', actions: [({ setContext }) => setContext({ n: 99 })] },
              {
                guard: ({ context }) => context.n < 3,
                actions: [({ context, setContext }) => setContext({ n: context.n + 1 })],
              },
            ],
          },
        },
      },
      implementations: { guards: { never: () => false } },
    })
    m.send({ type: 'tick' }) // 'never' false → falls to inline → n=1
    expect(m.context.n).toBe(1)
  })

  it('throws in dev when a guard name is not registered', () => {
    const m = createTransitions<'idle', object, { type: 'go' }>({
      initial: 'idle',
      context: {},
      states: { idle: { on: { go: { guard: 'missing', actions: [] } } } },
      // no implementations.guards
    })
    expect(() => m.send({ type: 'go' })).toThrow(/no guard "missing"/)
  })
})
