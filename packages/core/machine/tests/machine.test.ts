import { describe, expect, it } from 'vitest'
import {
  and,
  createMachine,
  not,
  or,
  type GuardArg,
  type MachineConfig,
  type Transition,
} from '@render-experiment/machine-core'

/**
 * End-to-end checks for the runtime side of guards: the machine accepts
 * inline functions and combinators wherever a name is accepted, and routes
 * the same Params object to both.
 */

interface Ctx {
  count: number
  allowed: boolean
}
interface Props {
  cap: number
}
type Event = { type: 'inc' } | { type: 'reset' }

function build(
  guard: GuardArg<Ctx, Props, Event>,
): ReturnType<typeof createMachine<Ctx, Props, Event>> {
  // Transition.guard is typed against the broadest GuardArg (Transition is
  // not generic over Ctx/Props/Event). Cast at the boundary — we know our
  // guard's Ctx/Props/Event match this machine's.
  const transitionGuard = guard as Transition['guard']
  const config: MachineConfig<Ctx, Props, Event> = {
    initial: 'idle',
    context: { count: 0, allowed: true },
    states: {
      idle: {
        on: {
          inc: {
            guard: transitionGuard,
            target: 'idle',
            actions: ['bump'],
          },
        },
      },
    },
    implementations: {
      actions: {
        bump: ({ context, setContext }) => setContext({ count: context.count + 1 }),
      },
      guards: {
        underCap: ({ context, props }) => context.count < props.cap,
        isAllowed: ({ context }) => context.allowed,
      },
    },
  }
  const m = createMachine<Ctx, Props, Event>(config, { cap: 2 })
  m.start()
  return m
}

describe('runtime guard resolution', () => {
  it('accepts a named guard string', () => {
    const m = build('underCap')
    m.send({ type: 'inc' })
    m.send({ type: 'inc' })
    m.send({ type: 'inc' }) // blocked: count would exceed cap
    expect(m.getContext().count).toBe(2)
  })

  it('accepts an inline guard function', () => {
    const m = build(({ context }) => context.count === 0)
    m.send({ type: 'inc' })
    m.send({ type: 'inc' }) // blocked: count is no longer 0
    expect(m.getContext().count).toBe(1)
  })

  it('accepts an and() combinator over inline guards', () => {
    const m = build(
      and(
        ({ context }) => context.count < 1,
        ({ context }) => context.allowed,
      ),
    )
    m.send({ type: 'inc' })
    m.send({ type: 'inc' }) // blocked
    expect(m.getContext().count).toBe(1)
  })

  it('accepts an or() over a never-passing pair', () => {
    const m = build(
      or(
        () => false,
        ({ context }) => context.count < 0,
      ),
    )
    m.send({ type: 'inc' })
    expect(m.getContext().count).toBe(0)
  })

  it('not() inverts an inline guard', () => {
    const m = build(not(({ context }) => context.count >= 1))
    m.send({ type: 'inc' })
    m.send({ type: 'inc' }) // blocked: count is 1
    expect(m.getContext().count).toBe(1)
  })
})
