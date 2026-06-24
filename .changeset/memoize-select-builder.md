---
'@dunky.dev/state-machine': patch
---

Memoize the `select` builder per machine. `machine.select` was a getter that rebuilt the whole builder — the callable plus its `.context`/`.computed`/`.state` scope methods, and a fresh `.bind` pair for the bus mutators — on **every** access, so `machine.select.context(k).subscribe(...)` allocated several throwaway objects per call. Since the builder closes only over the machine (identity permanent), it's now built once and cached: `machine.select` returns a stable reference across reads, and the shared bound bus mutators are reused by every `Selection`. A leaf list that calls `machine.select(...)` once per row on mount (the React adapter's `useSelector`) now allocates far less per mount; an isolated micro-bench of the per-row `select.context(k).subscribe()` shape runs ~1.9× faster. No behavior change beyond `select`'s now-stable identity.
