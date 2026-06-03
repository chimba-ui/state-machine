/**
 * Round 6c — withAdapter (platform injection seam).
 *
 * Pins: an agnostic config names effects/actions; withAdapter merges a
 * platform's actions + effects over the config's implementations (adapter
 * wins on collision); guards are NOT touched; the input config is not
 * mutated, so one config adapts to many platforms.
 */
import { describe, expect, it } from 'vitest'
import { machine, withAdapter } from '../src/machine'

type Ctx = { disabled: boolean }
type Ev = { type: 'open' | 'close' }

// Agnostic base: names everything, implements only the pure guard.
const baseConfig = {
  initial: 'closed' as const,
  context: { disabled: false },
  states: {
    closed: { on: { open: { target: 'open' as const, guard: 'canOpen' } } },
    open: {
      entry: ['focusFirstItem'],
      effects: ['trackOutsideClick'],
      on: { close: { target: 'closed' as const } },
    },
  },
  implementations: { guards: { canOpen: ({ context }: { context: Ctx }) => !context.disabled } },
}

describe('R6c — withAdapter', () => {
  it('injects platform effects + actions by name', () => {
    const log: string[] = []
    const domAdapter = {
      actions: { focusFirstItem: () => log.push('dom:focus') },
      effects: {
        trackOutsideClick: () => {
          log.push('dom:track:start')
          return () => log.push('dom:track:cleanup')
        },
      },
    }
    const m = machine<'closed' | 'open', Ctx, Ev>(withAdapter(baseConfig, domAdapter))
    m.start()
    m.send({ type: 'open' }) // canOpen passes → entry focuses, effect starts
    expect(log).toEqual(['dom:focus', 'dom:track:start'])
    m.send({ type: 'close' }) // effect cleanup runs first on exit
    expect(log).toEqual(['dom:focus', 'dom:track:start', 'dom:track:cleanup'])
  })

  it('the same agnostic config drives two different platforms', () => {
    const log: string[] = []
    const dom = {
      actions: { focusFirstItem: () => log.push('dom') },
      effects: { trackOutsideClick: () => {} },
    }
    const canvas = {
      actions: { focusFirstItem: () => log.push('canvas') },
      effects: { trackOutsideClick: () => {} },
    }

    machine<'closed' | 'open', Ctx, Ev>(withAdapter(baseConfig, dom)).send({
      type: 'open',
    })
    machine<'closed' | 'open', Ctx, Ev>(withAdapter(baseConfig, canvas)).send({
      type: 'open',
    })
    expect(log).toEqual(['dom', 'canvas'])
  })

  it('adapter wins over a config-provided default on name collision', () => {
    const log: string[] = []
    const configWithDefault = {
      ...baseConfig,
      implementations: {
        guards: baseConfig.implementations.guards,
        actions: { focusFirstItem: () => log.push('default') }, // config default
        effects: { trackOutsideClick: () => {} },
      },
    }
    const adapter = { actions: { focusFirstItem: () => log.push('platform') } }
    machine<'closed' | 'open', Ctx, Ev>(withAdapter(configWithDefault, adapter)).send({
      type: 'open',
    })
    expect(log).toEqual(['platform']) // adapter overrode the config default
  })

  it('preserves config guards (adapter does not touch them)', () => {
    const m = machine<'closed' | 'open', Ctx, Ev>(
      withAdapter(
        { ...baseConfig, context: { disabled: true } as Ctx },
        { actions: { focusFirstItem: () => {} }, effects: { trackOutsideClick: () => {} } },
      ),
    )
    m.send({ type: 'open' }) // canOpen=false (disabled) → blocked, still 'closed'
    expect(m.state).toBe('closed')
  })

  it('does not mutate the input config', () => {
    const before = baseConfig.implementations
    withAdapter(baseConfig, { actions: { focusFirstItem: () => {} } })
    expect(baseConfig.implementations).toBe(before) // same ref, untouched
    expect('actions' in baseConfig.implementations).toBe(false) // no actions leaked in
  })

  it('an adapter may supply only effects (actions optional) and vice-versa', () => {
    const log: string[] = []
    const cfg = {
      initial: 'a' as const,
      context: {},
      states: {
        a: { effects: ['e'], on: { go: { target: 'b' as const } } },
        b: {},
      },
    }
    const m = machine<'a' | 'b', object, { type: 'go' }>(
      withAdapter(cfg, { effects: { e: () => void log.push('e') } }), // no actions key
    )
    m.start()
    expect(log).toEqual(['e']) // start booted the initial effect
  })
})
