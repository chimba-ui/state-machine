/**
 * Round 6 (decision B) — initial-state effects start on start() (was: at
 * construction; A1 deferred the boot from construction to start()).
 *
 * Effects diverge from entry here: an initial state's effects attach when the
 * machine starts (a resting state still needs its listeners), whereas entry
 * (5d) fires only on a transition IN. The synthetic boot event is MACHINE_INIT;
 * cleanup fires on the first transition out (or on stop()).
 */
import { describe, expect, it } from 'vitest'
import { machine, MACHINE_INIT } from '../src/machine'

describe('R6b — initial-state effects at start', () => {
  it('does NOT start effects at construction; starts them on start()', () => {
    const log: string[] = []
    const m = machine<'idle', object, { type: 'noop' }>({
      initial: 'idle',
      context: {},
      states: { idle: { effects: [() => void log.push('start:idle')] } },
    })
    expect(log).toEqual([]) // built but stopped → no effects yet
    m.start()
    expect(log).toEqual(['start:idle']) // boot on start, no send needed
  })

  it('the boot event is MACHINE_INIT', () => {
    let seenType: string | undefined
    const m = machine<'idle', object, { type: 'noop' }>({
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
    m.start()
    expect(seenType).toBe(MACHINE_INIT)
    expect(MACHINE_INIT).toBe('machine.init')
  })

  it('cleanup of the initial effect runs on the first transition out', () => {
    const log: string[] = []
    const m = machine<'idle' | 'gone', object, { type: 'leave' }>({
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
    m.start()
    expect(log).toEqual(['start']) // started on start()
    m.send({ type: 'leave' })
    expect(log).toEqual(['start', 'cleanup']) // cleaned up leaving idle
  })

  it('stop() runs the active effect cleanups', () => {
    const log: string[] = []
    const m = machine<'idle', object, { type: 'noop' }>({
      initial: 'idle',
      context: {},
      states: { idle: { effects: [() => () => log.push('cleanup')] } },
    })
    m.start()
    m.stop()
    expect(log).toEqual(['cleanup'])
  })

  it('is restartable — start after stop re-boots the initial effect', () => {
    const log: string[] = []
    const m = machine<'idle', object, { type: 'noop' }>({
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
        },
      },
    })
    m.start()
    m.stop()
    m.start()
    expect(log).toEqual(['start', 'cleanup', 'start'])
  })

  it('entry of the initial state still does NOT fire on start (the divergence)', () => {
    const log: string[] = []
    const m = machine<'idle', object, { type: 'noop' }>({
      initial: 'idle',
      context: {},
      states: {
        idle: {
          entry: [() => log.push('entry')],
          effects: [() => void log.push('effect')],
        },
      },
    })
    m.start()
    // effect starts on start; entry does not — only effects start the resting state
    expect(log).toEqual(['effect'])
  })

  it('an effect can read context at start', () => {
    let seen: number | undefined
    const m = machine<'idle', { count: number }, { type: 'noop' }>({
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
    m.start()
    expect(seen).toBe(7)
  })
})
