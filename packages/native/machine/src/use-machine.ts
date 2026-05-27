import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createMachine, type Machine, type MachineConfig } from "@render-experiment/machine-core";

/**
 * React Native reactivity bridge for a machine instance.
 *
 * Mechanically identical to the React DOM useMachine (RN uses the same
 * React renderer and scheduler), kept as a duplicate file rather than a
 * re-export so RN-specific concerns can land here without coupling to
 * the React DOM package:
 *   - InteractionManager integration if heavy effects coincide with gestures
 *   - LogBox/error-handling differences
 *   - Reanimated/worklet-driven snapshots in the future
 *
 * Today it's a clean copy.
 */
export function useMachine<TContext extends object, TProps extends object>(
  config: MachineConfig<TContext, TProps>,
  props: TProps,
): Machine<TContext, TProps> {
  const configRef = useRef(config);
  const machine = useMemo(
    () => createMachine(configRef.current, props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  machine.setProps(props);

  useEffect(() => {
    machine.start();
    return () => machine.stop();
  }, [machine]);

  useSyncExternalStore(
    (notify) => machine.subscribe(notify),
    () => machine.getVersion(),
    () => machine.getVersion(),
  );

  return machine;
}
