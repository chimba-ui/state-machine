/**
 * Round 8b — select(fn): function-form selection + Selection.subscribe.
 *
 * Pins: select(fn) returns a Selection; .value reads the current selected
 * value (tracked, like signal.value); .subscribe fires listener(value) ONLY
 * when the selected value changes (Object.is default) — a context write that
 * doesn't change the selected value is silent; no fire-on-subscribe; an
 * optional equals handles composite (object) selections.
 */
import { effect } from '@preact/signals-core'
import { describe, expect, it, vi } from 'vitest'
import { machine } from '../src/machine'

const counter = () =>
  machine<'idle', { items: number[] }, { type: 'add' | 'noop' }>({
    initial: 'idle',
    context: { items: [] },
    states: {
      idle: {
        on: {
          add: {
            actions: [({ context, setContext }) => setContext({ items: [...context.items, 1] })],
          },
          noop: { actions: [() => {}] },
        },
      },
    },
  })

describe('R8b — select(fn)', () => {
  it('.value reads the current selected value', () => {
    const m = counter()
    const len = m.select(() => m.context.items.length)
    expect(len.value).toBe(0)
    m.send({ type: 'add' })
    expect(len.value).toBe(1)
  })

  it('subscribe fires listener(value) on a selected-value change, not on subscribe', () => {
    const m = counter()
    const len = m.select(() => m.context.items.length)
    const fn = vi.fn()
    len.subscribe(fn)
    expect(fn).not.toHaveBeenCalled() // no fire-on-subscribe
    m.send({ type: 'add' })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith(1) // receives the new selected value
  })

  it('value-dedup: a context change that does NOT change the selected value is silent', () => {
    const m = counter()
    const isEmpty = m.select(() => m.context.items.length === 0)
    const fn = vi.fn()
    isEmpty.subscribe(fn)
    m.send({ type: 'add' }) // 0→1 item: isEmpty true→false → FIRES
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith(false)
    m.send({ type: 'add' }) // 1→2 items: isEmpty false→false → unchanged → SILENT
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe stops notifications', () => {
    const m = counter()
    const len = m.select(() => m.context.items.length)
    const fn = vi.fn()
    const unsub = len.subscribe(fn)
    m.send({ type: 'add' })
    unsub()
    m.send({ type: 'add' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('a composite selection uses optional equals to dedup structurally', () => {
    const m = machine<
      'idle',
      { x: number; y: number; other: number },
      { type: 'moveX' | 'bumpOther' }
    >({
      initial: 'idle',
      context: { x: 0, y: 0, other: 0 },
      states: {
        idle: {
          on: {
            moveX: { actions: [({ context, setContext }) => setContext({ x: context.x + 1 })] },
            bumpOther: {
              actions: [({ context, setContext }) => setContext({ other: context.other + 1 })],
            },
          },
        },
      },
    })
    const pos = m.select(() => ({ x: m.context.x, y: m.context.y }))
    const shallow = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      a.x === b.x && a.y === b.y
    const fn = vi.fn()
    pos.subscribe(fn, shallow)
    m.send({ type: 'bumpOther' }) // pos selector doesn't read `other` → not re-run → silent
    expect(fn).not.toHaveBeenCalled()
    m.send({ type: 'moveX' }) // x changes → {x,y} differs by `shallow` → FIRES
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith({ x: 1, y: 0 })
  })

  it('without equals, a fresh-object selector fires every change (Object.is)', () => {
    const m = counter()
    const obj = m.select(() => ({ len: m.context.items.length }))
    const fn = vi.fn()
    obj.subscribe(fn) // default Object.is: new object each run is never ===
    m.send({ type: 'add' })
    expect(fn).toHaveBeenCalledTimes(1) // fires (different object identity)
  })

  it('.value is tracked — composes into a preact effect', () => {
    const m = counter()
    const len = m.select(() => m.context.items.length)
    const seen: number[] = []
    const dispose = effect(() => {
      seen.push(len.value)
    })
    m.send({ type: 'add' })
    m.send({ type: 'add' })
    dispose()
    m.send({ type: 'add' })
    expect(seen).toEqual([0, 1, 2])
  })
})
