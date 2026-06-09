# Research: time-travel as a middleware — feasibility, performance, and the XState claim

> Status: research note, not a shipped feature. Scope: `packages/core/machine`.
> Question asked: _can we add time-travel via a middleware? What's the most
> performant approach, and how does it square with the README's claims about
> XState?_

## TL;DR

- **Recording is free; restoring is the wall.** Every change funnels through
  `send`/`setContext`, and a written context is _shape-trivial_ to snapshot. But
  there is **no public way to set `(state, context)` to an arbitrary past value** —
  `setState` is private, `setContext` only shallow-merges over _current_, and
  `stateValue` has no writer.
- **The most performant true time-travel is snapshot + restore (O(1) per jump)**,
  which needs a ~5-line engine seam. The zero-engine-change alternative is
  replay-from-genesis (O(N) per jump), pure-public-API but effect-bound.
- **The README's XState claim is correct but slightly mis-attributed.** XState's
  cost isn't "it can persist" — it's "it allocates a fresh immutable snapshot _on
  every transition_, whether or not anyone records." A machine-core time-travel
  middleware inverts that: **you pay the snapshot cost only while recording is on,
  and nothing in steady state.** That's the genuinely interesting result.

---

## 1. What time-travel needs, graded against this design

| Capability                | Verdict | Why                                                                                                                                                                              |
| ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Record each step          | ✅ easy | Every change goes through `send` (events) or `setContext` (data). Wrap `send`; or `subscribe` fires after each `bump()`.                                                        |
| Capture full state        | ✅ easy | The full state is `{ stateValue, ctx }` — two plain values. Serializable as-is.                                                                                                  |
| **Restore a past state**  | ⚠️ wall | No public setter. `setState` private; `setContext` is a shallow merge over the _current_ object, not a replace; no `stateValue` writer. From outside you cannot rewind the live machine. |

So the design is **record-friendly, restore-hostile** — by intent (the engine
guards "state moves only via `send`").

---

## 2. The mutate-in-place subtlety that decides snapshot cost

The README says machine-core "mutates context in place." The precise behavior
(`machine.ts` `setContext`) is **copy-on-_first_-write, then mutate in place**:

```ts
if (!this.ownsCtx) {                 // first write only
  this.ctx = { ...this.ctx }         // clone once
  this.ownsCtx = true
}
Object.assign(this.ctx, patch)       // EVERY write assigns into the owned object
```

- Write #1 clones, so the original config object is never touched.
- **Write #2+ does _not_ clone** — it `Object.assign`s into the same owned object.

Consequence for time-travel: **a snapshot you keep by reference is corrupted by
the next write.** `const snap = m.context` then a later `setContext` mutates
`snap` too. So any recorder MUST copy at capture time: `{ ...m.context }` (shallow
— deep if context holds nested mutable objects). That per-step copy is the
unavoidable cost of recording on a mutate-in-place engine — and it's _only_ paid
when recording.

---

## 3. The two strategies, by performance

### A. Replay-from-genesis — O(N) per jump, **zero engine change**

Record the initial config + the ordered event tape. To view frame N, build a
**fresh, never-started** machine and re-`send` events `0..N`. A stopped machine
processes events as pure state transitions (`doSend` runs regardless of
`running`), and effects / `after` timers / watchers never fire while stopped
(`startEffects` is gated by `start()`), so replay is clean and side-effect-free.

```ts
function withTimeTravel(config) {
  const tape: Event[] = []
  const live = machine(config)
  const send = live.send
  live.send = e => { tape.push(e); send(e) }   // record, then forward

  return {
    machine: live,
    frameAt(n) {                                // pure, effect-free reconstruction
      const shadow = machine(config)            // never started
      for (let i = 0; i < n; i++) shadow.send(tape[i])
      return { state: shadow.state, context: { ...shadow.context } }
    },
    tape: () => tape.slice(),
  }
}
```

- **Cost:** recording is O(1)/event (push). A jump to frame N is O(N) sends.
  Scrubbing a 10k-event tape backwards is O(N²) naively → mitigate with periodic
  keyframes (snapshot every K events; replay from nearest keyframe ⇒ O(K)/jump).
- **Memory:** the event tape (tiny — events are small), not per-step context
  copies, unless you keep keyframes.
- **Limits:** non-determinism in actions (`Date.now`, `Math.random`, reading an
  external store) replays differently. Pure event→state machines replay exactly.
- **Restores the _live_ machine?** No — it reconstructs a _shadow_. To make the
  live view jump, you'd swap the connector onto the shadow (rebuild the
  connector, since it closes over `service.subscribe`) — clunky. Good for an
  inspector/timeline, not for live rewind.

### B. Snapshot + restore — O(1) per jump, **~5-line engine seam**

Add one dev-gated method to the engine:

```ts
restore(frame: { state: State; context: Context }): void {
  this.stateValue = frame.state
  this.ctx = { ...frame.context }   // own a private copy
  this.ownsCtx = true
  this.bump()                       // wake subscribers/select/connector
}
```

Recorder snapshots `{ state, context: { ...context } }` after each `bump()` (via
`subscribe`). Jumping to any frame is a single `restore(frame)` — **O(1)**, and it
rewinds the _live_ machine, so the existing connector/`select`/view update with no
re-pointing (it's just another `bump`).

- **Cost:** O(1)/jump. Recording cost = one shallow context copy per change
  (same copy the README says XState pays — but here _only when recording_).
- **Tradeoff:** punches a hole in the "state moves only via `send`" invariant.
  Gate it `if (isDev)` / behind a build flag so production keeps the guarantee.
- **This is the XState devtools model** (replace the snapshot), done surgically.

### Verdict on "most performant"

**B (snapshot + restore) is the most performant time-travel** — O(1) jumps,
live-machine rewind, recording cost identical to XState's snapshot cost but
_opt-in_. A is the right pick _only_ if "no engine change" is a hard line; then
add keyframes to keep scrub latency bounded.

### Measured cost (Node 24, this machine; baseline ≈ 3.8 M events/s)

Throughput overhead **while recording is ON** (off = zero, both strategies are
pure middleware so the hot path is the untouched engine):

| Mode                              | events/s | vs baseline    |
| --------------------------------- | -------- | -------------- |
| baseline (recording off)          | 3.81 M/s | —              |
| A — event-tape push               | 3.75 M/s | ~1% (noise)    |
| B — snapshot/change, 6-field ctx  | 2.82 M/s | **~35% slower** |
| B — snapshot/change, 64-field ctx | 1.50 M/s | **~154% slower** |

Memory retained per recorded event:

| Mode                  | per event | per 500k events |
| --------------------- | --------- | --------------- |
| A — event tape        | ~41 B     | ~21 MB          |
| B — snapshot, 6-field | ~145 B    | ~73 MB          |
| B — snapshot, 64-field| ~601 B    | ~301 MB         |

Takeaways: the **event tape is nearly free** (record-cheap, jump-expensive); the
**snapshot is the tax**, dominated by the `{ ...context }` copy and scaling with
field count (record-expensive, jump-instant). Keyframes cap both. Crucially the
cost is **zero when off** — unlike XState's always-on per-transition snapshot.

---

## 4. Squaring this with the README's XState claims

README (machine README §"How it compares"):

> _"every [XState] transition allocates a serializable snapshot you can persist,
> replay, and inspect… each one taxes the hot path. machine-core drops the
> snapshot, so it can mutate in place… If you need to persist or time-travel a
> machine, XState is the right tool."_

Three findings:

1. **The claim is directionally true but the cost is mis-located.** XState's tax
   isn't "the ability to time-travel" — it's that it allocates an immutable
   snapshot **unconditionally, every transition**, recording or not. machine-core
   pays nothing in steady state. A time-travel middleware moves the snapshot cost
   to **only when the devtool is recording** — so the trade the README frames as
   "fast _xor_ time-travel" is really **"fast always, time-travel when you opt in,
   snapshot cost only then."** That's a stronger story than the README tells.

2. **"❌ (the cost of mutating in place)" overstates the impossibility.** It's true
   there's no _built-in_ snapshot API, and true that you can't keep a snapshot by
   reference (§2). But the data _shape_ is trivially serializable, so persist /
   replay / time-travel are all reachable via a thin middleware (A today, B with
   5 lines). The honest line is "no built-in snapshot — bring your own recorder,"
   not "can't."

3. **Where XState still wins, legitimately:** _automatic, always-on_
   serialization (every actor snapshot is persistable with zero setup), and
   deterministic replay guarantees baked into the actor model. machine-core's
   replay determinism is the _author's_ responsibility (keep actions pure). For a
   persistence-first app, the README's "reach for XState" stands. For "fast many
   machines, optional dev-time time-travel," the middleware is the better fit.

### Suggested README tightening (if we act on this)

The line _"Serializable snapshot (persist/replay): ❌ (the cost of mutating in
place)"_ could become _"⚠️ no built-in snapshot; a thin recorder middleware adds
persist/replay/time-travel, paying the snapshot cost only while recording"_ — more
accurate, and it turns a perceived weakness into a deliberate, opt-in design.

---

## 5. What time-travel still does NOT give you (gaps that survive, even ON)

A recorder buys _record + restore of state_. It does not close these — they're
the README's "dropped features" that a middleware can't fully recover:

1. **Effects / `after` timers / watchers don't replay.** Rewind moves _state_,
   not the world. A reconstructed (A) or restored (B) machine doesn't re-fire
   `effects`, re-arm `after` timers, or re-run watchers — they're gated by
   `start()`, and replay runs against a stopped machine. "Travel to when the
   tooltip was `opening`" gives the right state but no live open-delay timer and
   no DOM listener. Full fidelity needs effect/timer reconciliation on restore —
   out of scope for a recorder.
2. **Non-deterministic actions don't reconstruct (strategy A).** Replay re-runs
   actions, so `Date.now()` / `Math.random()` / external-store reads diverge.
   Determinism is the _author's_ job here (XState bakes it into the actor model).
   Snapshot+restore (B) sidesteps this — it stores results, doesn't recompute.
3. **No serialization guarantee.** A snapshot is JSON-safe only if your context
   is (no functions, class instances, cycles). The engine hands you the _shape_,
   not a safe-to-serialize promise.
4. **Composed history isn't globally coherent.** `compose` runs peers
   independently; per-machine recorders give per-region timelines, not one
   causally-ordered cross-region history. A unified timeline needs a shared
   sequencer wrapping all members.
5. **The visual inspector is still UI work.** Recording produces the _data_ for a
   timeline; a Stately-style graph view is separate, not unlocked by the recorder.

---

## 6. Recommendation

- Want a **timeline/inspector** with no engine change → ship **A** (replay +
  keyframes), pure middleware, dev-only.
- Want **live rewind** at the lowest cost → add the **B** `restore()` seam
  (dev-gated) and a `withRecorder(machine)` that snapshots on `subscribe`.
- Either way, document the determinism contract (pure actions) and that recording
  copies context per step (the §2 cost).
