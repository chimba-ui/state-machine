---
'@dunky.dev/state-machine-utils': major
---

Rename `@dunky.dev/shared-state-machine` → `@dunky.dev/state-machine-utils`.

The package holds the substrate-agnostic utilities (`mergeProps`, `composeHandlers`,
positioning, memo) rather than anything "shared" in a vague sense — every other
`@dunky.dev/*` package is also shared. The new name says what it is. Consumers and
the target packages (`react`/`native`) import from the new name; this is a
breaking rename for anyone depending on the old package id.
