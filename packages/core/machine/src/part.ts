/**
 * Part — the shape of a single named slice on a connect() API.
 *
 * Every component's connect output groups its rendered surfaces under
 * `api.parts`. Each part has, at minimum, a `handlers` bag (events the
 * adapter wires up) and an `attrs` bag (attributes the adapter applies).
 *
 * Most parts also expose:
 *   - `variants`: the cross-substrate styling variant prop set, computed
 *     in the connect from state + props so adapters don't re-derive.
 *   - extras: positioning, rendered flag, anything component-specific.
 *
 * The two generics are independent on purpose:
 *
 *   Part                       — handlers + attrs only
 *   Part<MyVariants>           — adds typed variants
 *   Part<MyVariants, MyExtras> — adds typed extras (e.g., positioning)
 *
 * Authors who don't need variants still benefit from the typing: a
 * Separator's part is just `Part` (no variants, no extras).
 */

import type { AttrBindings, EventBindings } from "./bindings";

export type Part<
  TVariants extends object = never,
  TExtras extends object = never,
> = {
  handlers: EventBindings;
  attrs: AttrBindings;
} & ([TVariants] extends [never] ? unknown : { variants: TVariants }) &
  ([TExtras] extends [never] ? unknown : TExtras);
