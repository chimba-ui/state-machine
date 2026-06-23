---
'benchmark-demo': patch
---

Rework the live demo's two run modes and how it scores them.

**Survival test** — ramp the load until every engine drowns, then stop:

```
load ▲                          ┌──────────────┐
     │            ramps up      │ each engine: │
     │         ───────────────▶ │ survived N/s │
     │                          │ + N/ops      │
     └──────────────────────────┴──────────────┘
```

**15s test** — run the full 15s, then rank by who lasted longest:

```
┌──────────┐  longest survivor   ┌──────────┐
│  lib1    │ ──────────────────▶ │  faster  │ ✓ green
├──────────┤                     ├──────────┤
│  lib2    │ ──────────────────▶ │  slower  │ ✗ red
└──────────┘                     └──────────┘
```

- **`updates/s`** is now a run-average (`totalApplied / totalElapsed`), shown as **% of vanilla** — the old last-250ms snapshot jumped around and tied fast engines with the control.
- **"survived Ns"** replaces "fell behind by N": time-to-divergence ranks with speed (faster lasts longer).
