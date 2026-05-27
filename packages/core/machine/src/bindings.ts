/**
 * Bindings — substrate-agnostic event + attribute vocabulary for machine
 * connect() outputs.
 *
 * Every component's machine speaks this vocabulary. The connect() return
 * produces `EventBindings` (handlers bound to gestures/inputs) and
 * `AttrBindings` (attributes bound to values). Each adapter translates
 * them to its renderer's native props:
 *
 *   React DOM   : machine-react/normalize   (onPress → onClick, …)
 *   Native (RN) : machine-native/normalize  (onPress → Pressable.onPress, …)
 *   Surface     : machine-surface/normalize (future)
 *
 * The payload types below pin the fields a handler can rely on across
 * substrates. Anything substrate-specific (clientX, nativeEvent,
 * currentTarget) lives behind the adapter and is invisible to component
 * authors.
 */

// -----------------------------------------------------------------------------
// Event payloads
// -----------------------------------------------------------------------------

export interface PointerPayload {
  /** True when an upstream handler called preventDefault / equivalent. */
  defaultPrevented?: boolean;
  /** Pointer button number. 0 is primary on every substrate. */
  button?: number;
  /** Input modality. Canvas/RN can supply "touch" or "mouse"; web supplies all three. */
  pointerType?: "mouse" | "touch" | "pen";
}

export interface KeyboardPayload {
  defaultPrevented?: boolean;
  /** Logical key name. Matches `KeyboardEvent.key` on web. */
  key?: string;
}

// -----------------------------------------------------------------------------
// Event bindings — handlers bound to user input
// -----------------------------------------------------------------------------

export interface EventBindings {
  /** "user clicked / tapped / activated this thing." */
  onPress?: (event?: PointerPayload) => void;

  onPointerEnter?: (event?: PointerPayload) => void;
  onPointerLeave?: (event?: PointerPayload) => void;
  onPointerMove?: (event?: PointerPayload) => void;
  onPointerDown?: (event?: PointerPayload) => void;
  onPointerUp?: (event?: PointerPayload) => void;
  onPointerCancel?: (event?: PointerPayload) => void;

  onFocus?: () => void;
  onBlur?: () => void;

  onKeyDown?: (event?: KeyboardPayload) => void;
  onKeyUp?: (event?: KeyboardPayload) => void;
}

// -----------------------------------------------------------------------------
// Attr bindings — attributes bound to values
// -----------------------------------------------------------------------------

export interface AttrBindings {
  id?: string;

  /** "this element's description is over there" (ARIA describedby). */
  describedBy?: string;
  /** "this element's label is over there" (ARIA labelledby). */
  labelledBy?: string;

  /** Boolean state (open/closed disclosure regions). */
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
  hidden?: boolean;

  /**
   * Whether the element participates in keyboard focus.
   * Adapters map to `tabIndex` (web) / `accessible` (RN) / etc.
   */
  focusable?: boolean;

  /** ARIA role on web; equivalent semantic tag on other substrates. */
  role?: string;
}
