/**
 * Substrate-agnostic positioning vocabulary.
 *
 * `Placement` and `PositioningOptions` are the same shape every floating
 * component (tooltip, dropdown, popover, …) consumes; the resolver math
 * in each component's connect / adapter doesn't change across components.
 *
 * Lives in machine-core so we don't duplicate the enum + helper per
 * component. Pure data — no React, no DOM, no Pixi.
 */

export type Placement =
  | "top"
  | "top-start"
  | "top-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "left-start"
  | "left-end"
  | "right"
  | "right-start"
  | "right-end";

export interface PositioningOptions {
  placement: Placement;
  offset: { main: number; cross: number };
}

const sideMap: Record<Placement, "top" | "bottom" | "left" | "right"> = {
  top: "top",
  "top-start": "top",
  "top-end": "top",
  bottom: "bottom",
  "bottom-start": "bottom",
  "bottom-end": "bottom",
  left: "left",
  "left-start": "left",
  "left-end": "left",
  right: "right",
  "right-start": "right",
  "right-end": "right",
};

/** Convert a logical placement to its base side (the `side` variant key). */
export function placementToSide(
  p: Placement,
): "top" | "bottom" | "left" | "right" {
  return sideMap[p];
}
