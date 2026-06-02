/**
 * Round 6 (decision B) — initial-state effects start at construction.
 *
 * Effects diverge from entry here: an initial state's effects attach at boot
 * (a resting state still needs its listeners), whereas entry (5d) fires only
 * on a transition IN. The synthetic boot event is MACHINE_INIT; cleanup fires
 * on the first transition out.
 */
import { describe, expect, it } from 'vitest'
import { createTransitions, MACHINE_INIT } from '../src/machine'

describe('R6b — initial-state effects at boot', () => {
  it('starts the initial state effect at construction (before any send)', () => {
    const log: string[] = []
    createTransitions<'idle', object, { type: 'noop' }>({
      initial: 'idle',
      context: {},
      states: { idle: { effects: [() => void log.push('start:idle')] } },
    })
    expect(log).toEqual(['start:idle']) // fired at construction, no send needed
  })

  it('the boot event is MACHINE_INIT', () => {
    let seenType: string | undefined
    createTransitions<'idle', object, { type: 'noop' }>({
      initial: 'idle',
      context: {},
      states: {
        idle: {
          effects: [
            ({ event }) => {
              seenType = event.type
            },
          ],
        },
      },
    })
    expect(seenType).toBe(MACHINE_INIT)
    expect(MACHINE_INIT).toBe('machine.init')
  })

  it('cleanup of the initial effect runs on the first transition out', () => {
    const log: string[] = []
    const m = createTransitions<'idle' | 'gone', object, { type: 'leave' }>({
      initial: 'idle',
      context: {},
      states: {
        idle: {
          effects: [
            () => {
              log.push('start')
              return () => log.push('cleanup')
            },
          ],
          on: { leave: { target: 'gone' } },
        },
        gone: {},
      },
    })
    expect(log).toEqual(['start']) // started at boot
    m.send({ type: 'leave' })
    expect(log).toEqual(['start', 'cleanup']) // cleaned up leaving idle
  })

  it('entry of the initial state still does NOT fire at boot (the divergence)', () => {
    const log: string[] = []
    createTransitions<'idle', object, { type: 'noop' }>({
      initial: 'idle',
      context: {},
      states: {
        idle: {
          entry: [() => log.push('entry')],
          effects: [() => void log.push('effect')],
        },
      },
    })
    // effect starts at boot; entry does not — only effects start the resting state
    expect(log).toEqual(['effect'])
  })

  it('an effect can read context at boot', () => {
    let seen: number | undefined
    createTransitions<'idle', { count: number }, { type: 'noop' }>({
      initial: 'idle',
      context: { count: 7 },
      states: {
        idle: {
          effects: [
            ({ context }) => {
              seen = context.count
            },
          ],
        },
      },
    })
    expect(seen).toBe(7)
  })
})
