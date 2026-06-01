import { describe, expect, it } from 'vitest'
import { and, not, or } from '@render-experiment/machine-core'
import type { Guard } from '@render-experiment/machine-core'

// Stub Params just enough for type-checking. The combinators don't read
// the params themselves — they only forward them to inner guards.
const PARAMS = {
  context: {},
  props: {},
  event: { type: '_' },
} as Parameters<Guard<object, object, { type: '_' }>>[0]

const T: Guard<object, object, { type: '_' }> = () => true
const F: Guard<object, object, { type: '_' }> = () => false

describe('and', () => {
  it('returns true when every guard passes', () => {
    expect(and(T, T, T)(PARAMS)).toBe(true)
  })
  it('returns false when any guard fails', () => {
    expect(and(T, F, T)(PARAMS)).toBe(false)
  })
  it('returns true with zero arguments (empty intersection)', () => {
    expect(and()(PARAMS)).toBe(true)
  })
  it('short-circuits on the first failing guard', () => {
    let ran = 0
    const tick: Guard<object, object, { type: '_' }> = () => {
      ran++
      return true
    }
    and(tick, F, tick)(PARAMS)
    expect(ran).toBe(1)
  })
})

describe('or', () => {
  it('returns true when any guard passes', () => {
    expect(or(F, T, F)(PARAMS)).toBe(true)
  })
  it('returns false when every guard fails', () => {
    expect(or(F, F)(PARAMS)).toBe(false)
  })
  it('returns false with zero arguments (empty union)', () => {
    expect(or()(PARAMS)).toBe(false)
  })
  it('short-circuits on the first passing guard', () => {
    let ran = 0
    const tick: Guard<object, object, { type: '_' }> = () => {
      ran++
      return false
    }
    or(tick, T, tick)(PARAMS)
    expect(ran).toBe(1)
  })
})

describe('not', () => {
  it('negates true to false', () => {
    expect(not(T)(PARAMS)).toBe(false)
  })
  it('negates false to true', () => {
    expect(not(F)(PARAMS)).toBe(true)
  })
})

describe('composition', () => {
  it('arbitrary nesting works', () => {
    // (T && !F) || (F && T)  →  true
    expect(or(and(T, not(F)), and(F, T))(PARAMS)).toBe(true)
  })
  it('forwards params to inner guards', () => {
    const seen: unknown[] = []
    const spy: Guard<{ x: number }, object, { type: '_' }> = ({ context }) => {
      seen.push(context)
      return true
    }
    const params = {
      context: { x: 1 },
      props: {},
      event: { type: '_' as const },
      computed: {} as Record<string, never>,
      guard: () => false,
    }
    and(spy, not(spy))(params)
    expect(seen).toEqual([{ x: 1 }, { x: 1 }])
  })
})
