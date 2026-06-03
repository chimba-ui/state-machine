/**
 * Round 4c — guard combinators and / or / not.
 *
 * Pins: combinators compose GuardArgs (names OR inline fns), resolving each
 * through the runtime's single registry channel (params.guard). Compose deep.
 */
import { describe, expect, it } from 'vitest'
import { and, machine, not, or } from '../src/machine'

describe('R4c — and / or / not', () => {
  it('and(): true only when every sub-guard passes (names)', () => {
    let ran = false
    const m = machine<'idle', { a: boolean; b: boolean }, { type: 'go' }>({
      initial: 'idle',
      context: { a: true, b: true },
      states: {
        idle: {
          on: {
            go: {
              guard: and('isA', 'isB'),
              actions: [
                () => {
                  ran = true
                },
              ],
            },
          },
        },
      },
      implementations: {
        guards: { isA: ({ context }) => context.a, isB: ({ context }) => context.b },
      },
    })
    m.send({ type: 'go' })
    expect(ran).toBe(true)
  })

  it('and(): blocks when one sub-guard fails', () => {
    let ran = false
    const m = machine<'idle', { a: boolean; b: boolean }, { type: 'go' }>({
      initial: 'idle',
      context: { a: true, b: false },
      states: {
        idle: {
          on: {
            go: {
              guard: and('isA', 'isB'),
              actions: [
                () => {
                  ran = true
                },
              ],
            },
          },
        },
      },
      implementations: {
        guards: { isA: ({ context }) => context.a, isB: ({ context }) => context.b },
      },
    })
    m.send({ type: 'go' })
    expect(ran).toBe(false)
  })

  it('or(): true when any passes; not(): negates; mixed names + inline fns', () => {
    let ran = false
    const m = machine<'idle', { locked: boolean }, { type: 'go'; force?: boolean }>({
      initial: 'idle',
      context: { locked: true },
      states: {
        idle: {
          on: {
            go: {
              // or( inline force, and(not('locked'? no) ...) ) — exercise mix + nesting
              guard: or(({ event }) => !!event.force, not('isLocked')),
              actions: [
                () => {
                  ran = true
                },
              ],
            },
          },
        },
      },
      implementations: { guards: { isLocked: ({ context }) => context.locked } },
    })
    m.send({ type: 'go' }) // locked, no force → not(isLocked)=false, force=false → blocked
    expect(ran).toBe(false)
    m.send({ type: 'go', force: true }) // force=true → or passes → runs
    expect(ran).toBe(true)
  })

  it('combinators accept inline functions too (not just names)', () => {
    let ran = false
    const isPos = ({ context }: { context: { n: number } }) => context.n > 0
    const m = machine<'idle', { n: number }, { type: 'go' }>({
      initial: 'idle',
      context: { n: 5 },
      states: {
        idle: {
          on: {
            go: {
              guard: and(
                isPos,
                not(({ context }) => context.n > 100),
              ),
              actions: [
                () => {
                  ran = true
                },
              ],
            },
          },
        },
      },
    })
    m.send({ type: 'go' }) // n=5: >0 AND not(>100) → true
    expect(ran).toBe(true)
  })

  it('nests deeply: and(or(...), not(and(...)))', () => {
    let ran = false
    const m = machine<'idle', { x: number }, { type: 'go' }>({
      initial: 'idle',
      context: { x: 2 },
      states: {
        idle: {
          on: {
            go: {
              guard: and(or('isTwo', 'isThree'), not(and('isTwo', 'isOdd'))),
              actions: [
                () => {
                  ran = true
                },
              ],
            },
          },
        },
      },
      implementations: {
        guards: {
          isTwo: ({ context }) => context.x === 2,
          isThree: ({ context }) => context.x === 3,
          isOdd: ({ context }) => context.x % 2 === 1,
        },
      },
    })
    // x=2: or(isTwo,isThree)=true; and(isTwo,isOdd)=true&false=false; not(false)=true → true
    m.send({ type: 'go' })
    expect(ran).toBe(true)
  })
})
