/**
 * Round 4a — inline guards + params shape.
 *
 * Pins: a guard is a predicate receiving the FINAL { context, event, computed }
 * params (computed is {} until R7), and an inline guard gates a transition.
 */
import { describe, expect, it } from 'vitest'
import { machine } from '../src/machine'

describe('R4a — inline guards', () => {
  it('an inline guard gates the transition (true = taken)', () => {
    const m = machine<'idle', { allow: boolean }, { type: 'go' }>({
      initial: 'idle',
      context: { allow: true },
      states: {
        idle: {
          on: {
            go: {
              guard: ({ context }) => context.allow,
              actions: [({ setContext }) => setContext({ allow: false })],
            },
          },
        },
      },
    })
    m.send({ type: 'go' }) // allow=true → runs → sets allow=false
    expect(m.context.allow).toBe(false)
    m.send({ type: 'go' }) // allow=false → guard blocks → no change
    expect(m.context.allow).toBe(false)
  })

  it('a guard can read the event payload', () => {
    const m = machine<'idle', { n: number }, { type: 'add'; by: number }>({
      initial: 'idle',
      context: { n: 0 },
      states: {
        idle: {
          on: {
            add: {
              guard: ({ event }) => event.by > 0, // only positive additions
              actions: [
                ({ context, setContext, event }) => setContext({ n: context.n + event.by }),
              ],
            },
          },
        },
      },
    })
    m.send({ type: 'add', by: 5 })
    expect(m.context.n).toBe(5)
    m.send({ type: 'add', by: -3 }) // guard blocks negative
    expect(m.context.n).toBe(5)
  })

  it('guard params include `computed` (empty until R7) — destructurable now', () => {
    let sawComputed: unknown
    const m = machine<'idle', object, { type: 'check' }>({
      initial: 'idle',
      context: {},
      states: {
        idle: {
          on: {
            check: {
              guard: ({ computed }) => {
                sawComputed = computed
                return true
              },
              actions: [],
            },
          },
        },
      },
    })
    m.send({ type: 'check' })
    expect(sawComputed).toEqual({}) // wired in R7; empty object for now
  })
})
