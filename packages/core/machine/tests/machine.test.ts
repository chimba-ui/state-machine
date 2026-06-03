import { describe, expect, it } from 'vitest'
import {
  and,
  choose,
  createMachine,
  not,
  or,
  setup,
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

/**
 * choose([...]) — runtime picks one action branch by guard.
 */
describe('choose()', () => {
  type Evt = { type: 'go' }
  interface ChooseCtx {
    log: string[]
  }
  const make = (chosen: ReturnType<typeof choose>) => {
    const config: MachineConfig<ChooseCtx, object, Evt> = {
      initial: 'idle',
      context: { log: [] },
      states: {
        idle: { on: { go: { actions: chosen } } },
      },
      implementations: {
        actions: {
          a: ({ context, setContext }) => setContext({ log: [...context.log, 'a'] }),
          b: ({ context, setContext }) => setContext({ log: [...context.log, 'b'] }),
          c: ({ context, setContext }) => setContext({ log: [...context.log, 'c'] }),
        },
      },
    }
    const m = createMachine<ChooseCtx, object, Evt>(config, {})
    m.start()
    return m
  }

  it('picks the first matching branch', () => {
    const m = make(
      choose([
        { guard: () => false, actions: ['a'] },
        { guard: () => true, actions: ['b'] },
        { actions: ['c'] }, // never reached
      ]),
    )
    m.send({ type: 'go' })
    expect(m.getContext().log).toEqual(['b'])
  })

  it('falls through to the guardless branch when no guards match', () => {
    const m = make(choose([{ guard: () => false, actions: ['a'] }, { actions: ['c'] }]))
    m.send({ type: 'go' })
    expect(m.getContext().log).toEqual(['c'])
  })

  it('runs nothing when every branch is guarded and none match', () => {
    const m = make(
      choose([
        { guard: () => false, actions: ['a'] },
        { guard: () => false, actions: ['b'] },
      ]),
    )
    m.send({ type: 'go' })
    expect(m.getContext().log).toEqual([])
  })
})

/**
 * setup<Schema>().guards — schema-bound combinators that accept named
 * guards from the schema (typo-checked) alongside inline functions.
 */
describe('setup().guards combinators', () => {
  type Schema = {
    context: { x: number }
    props: object
    event: { type: 'tick' }
    state: 'idle'
    guards: 'isPositive' | 'isEven'
    actions: 'mark'
  }

  it('resolves named guards via the implementations registry', () => {
    const s = setup<Schema>()
    const { and, not } = s.guards

    const cfg = s.createMachine({
      initial: 'idle',
      context: { x: 4 },
      states: {
        idle: {
          on: {
            tick: {
              guard: and('isPositive', not('isEven')),
              actions: [],
            },
          },
        },
      },
      implementations: {
        guards: {
          isPositive: ({ context }) => context.x > 0,
          isEven: ({ context }) => context.x % 2 === 0,
        },
      },
    })

    // x=4: positive (true) AND not even (false) → false, no transition.
    const m = createMachine(cfg, {})
    m.start()
    let fired = 0
    m.subscribe(() => fired++)
    m.send({ type: 'tick' })
    expect(fired).toBe(0)
  })

  it('mixes named guards with inline functions', () => {
    const s = setup<Schema>()
    const { or } = s.guards

    const cfg = s.createMachine({
      initial: 'idle',
      context: { x: -3 },
      states: {
        idle: {
          on: {
            // x=-3: positive (false) OR negative (true) → true → fires `mark`.
            tick: {
              guard: or('isPositive', ({ context }) => context.x < 0),
              target: 'idle',
              actions: ['mark'],
            },
          },
        },
      },
      implementations: {
        guards: {
          isPositive: ({ context }) => context.x > 0,
          isEven: ({ context }) => context.x % 2 === 0,
        },
        // observable side-effect proving the guarded transition was taken
        actions: { mark: ({ context, setContext }) => setContext({ x: context.x + 100 }) },
      },
    })

    // Probe the transition by its observable effect (the action ran), not by
    // a notify count — the signal-backed subscribe fires on observable change,
    // not on every matched transition.
    const m = createMachine(cfg, {})
    m.start()
    expect(m.getContext().x).toBe(-3)
    m.send({ type: 'tick' })
    expect(m.getContext().x).toBe(97) // guard passed → `mark` ran
  })
})

// -----------------------------------------------------------------------------
// subscribeSelector — fine-grained, selector-based subscription (the payoff)
//
// The whole point of the signal-backed context: a selector reads cells/state
// through the tracked snapshot, so it auto-subscribes to exactly what it
// touches and fires only when its selected value changes (O(readers), not
// O(all)). The coarse `subscribe` still wakes on any change.
// -----------------------------------------------------------------------------

describe('subscribeSelector (fine-grained)', () => {
  type Ctx = { a: number; b: number }
  type Ev = { type: 'setA' } | { type: 'setB' }

  const make = () => {
    const cfg: MachineConfig<Ctx, object, Ev> = {
      initial: 'idle',
      context: () => ({ a: 0, b: 0 }),
      states: {
        idle: {
          on: {
            setA: { actions: ['bumpA'] },
            setB: { actions: ['bumpB'] },
          },
        },
      },
      implementations: {
        actions: {
          bumpA: ({ context, setContext }) => setContext({ a: context.a + 1 }),
          bumpB: ({ context, setContext }) => setContext({ b: context.b + 1 }),
        },
      },
    }
    const m = createMachine(cfg, {})
    m.start()
    return m
  }

  it('wakes only the selector that read the changed cell', () => {
    const m = make()
    let aFires = 0
    let bFires = 0
    m.subscribeSelector(
      s => s.context.a,
      () => aFires++,
    )
    m.subscribeSelector(
      s => s.context.b,
      () => bFires++,
    )

    m.send({ type: 'setA' })
    expect(aFires).toBe(1)
    expect(bFires).toBe(0) // b's selector didn't read a → must not fire

    m.send({ type: 'setB' })
    expect(aFires).toBe(1) // a stays put
    expect(bFires).toBe(1)
  })

  it('fires only when the SELECTED value changes, not on every cell write', () => {
    const m = make()
    let fires = 0
    // selector derives a boolean; it changes value only when a crosses 2
    m.subscribeSelector(
      s => s.context.a > 2,
      () => fires++,
    )
    m.send({ type: 'setA' }) // a=1, false → false: no fire
    m.send({ type: 'setA' }) // a=2, false → false: no fire
    expect(fires).toBe(0)
    m.send({ type: 'setA' }) // a=3, false → true: FIRE
    expect(fires).toBe(1)
  })

  it('a multi-cell selector wakes when either cell it read changes', () => {
    const m = make()
    let fires = 0
    m.subscribeSelector(
      s => s.context.a + s.context.b,
      () => fires++,
    )
    m.send({ type: 'setA' })
    m.send({ type: 'setB' })
    expect(fires).toBe(2)
  })

  it('select() reads the current selected value', () => {
    const m = make()
    expect(m.select(s => s.context.a)).toBe(0)
    m.send({ type: 'setA' })
    expect(m.select(s => s.context.a)).toBe(1)
  })

  it('coarse subscribe still wakes on any cell change', () => {
    const m = make()
    let coarse = 0
    m.subscribe(() => coarse++)
    m.send({ type: 'setA' })
    m.send({ type: 'setB' })
    expect(coarse).toBe(2)
  })

  it('a state selector wakes on state transitions', () => {
    const cfg: MachineConfig<{ n: number }, object, { type: 'go' }> = {
      initial: 'one',
      context: () => ({ n: 0 }),
      states: {
        one: { on: { go: { target: 'two' } } },
        two: {},
      },
    }
    const m = createMachine(cfg, {})
    m.start()
    let stateFires = 0
    m.subscribeSelector(
      s => s.state,
      () => stateFires++,
    )
    m.send({ type: 'go' })
    expect(stateFires).toBe(1)
    expect(m.getState()).toBe('two')
  })

  it('unsubscribe stops further notifications', () => {
    const m = make()
    let aFires = 0
    const off = m.subscribeSelector(
      s => s.context.a,
      () => aFires++,
    )
    m.send({ type: 'setA' })
    expect(aFires).toBe(1)
    off()
    m.send({ type: 'setA' })
    expect(aFires).toBe(1) // no longer notified
  })
})
