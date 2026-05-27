/**
 * Machine DSL — a Zag-shaped library with NO substrate assumptions.
 *
 * A machine config is data: states, events, transitions, named guards/actions/effects.
 * The `connect` output is LOGICAL: no `onClick`, no `aria-*`, no `style`, no `data-*`.
 * Target adapters translate that logical surface to a specific renderer.
 */

export type EventObject = { type: string; [key: string]: unknown };

export interface Params<TContext, TProps> {
  context: TContext;
  setContext: (patch: Partial<TContext>) => void;
  props: TProps;
  event: EventObject;
  send: (event: EventObject) => void;
}

export type Action<TContext, TProps> = (
  params: Params<TContext, TProps>,
) => void;

export type Guard<TContext, TProps> = (
  params: Omit<Params<TContext, TProps>, "send" | "setContext">,
) => boolean;

export type Effect<TContext, TProps> = (
  params: Omit<Params<TContext, TProps>, "event">,
) => VoidFunction | void;

export interface Transition {
  target?: string;
  guard?: string;
  actions?: string[];
}

export interface StateNode {
  entry?: string[];
  exit?: string[];
  effects?: string[];
  on?: Record<string, Transition | Transition[]>;
}

export interface MachineConfig<TContext, TProps = Record<string, unknown>> {
  initial: string | ((props: TProps) => string);
  context: TContext | ((props: TProps) => TContext);
  states: Record<string, StateNode>;
  on?: Record<string, Transition | Transition[]>;
  implementations?: {
    actions?: Record<string, Action<TContext, TProps>>;
    guards?: Record<string, Guard<TContext, TProps>>;
    effects?: Record<string, Effect<TContext, TProps>>;
  };
}

export interface Machine<TContext, TProps = Record<string, unknown>> {
  getState: () => string;
  getContext: () => TContext;
  getProps: () => TProps;
  /**
   * Monotonic counter that bumps on every state transition or context
   * change. Designed as a cheap "did anything change?" snapshot for
   * subscribers like React's useSyncExternalStore.
   */
  getVersion: () => number;
  setProps: (next: TProps) => void;
  send: (event: EventObject) => void;
  subscribe: (listener: () => void) => () => void;
  start: () => void;
  stop: () => void;
}
