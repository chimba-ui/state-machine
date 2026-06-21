import type { Implementations, TransitionConfig, AnyString } from './types'

/**
 * The shared authoring chain, parameterized by the machine types. Both entry
 * points (`setup.infer()` and `setup.as<...>()`) return this same object — they
 * differ only in whether `Context`/`Event` are inferred from the literal
 * (`infer`, both default to `never`) or pinned explicitly (`as<Ctx, Ev>`).
 */
function chain<Context extends object, Event extends { type: string }, Computed>() {
  return {
    /**
     * Build a config directly — no named-impl registries, names left loose.
     * Under `setup.infer()`, `State` / `Context` / `Event` are inferred from the
     * literal. For checked names, go through `.config(registries)` first.
     */
    createMachine<
      State extends string,
      C extends object = Context,
      E extends { type: string } = Event,
      Cm = Computed,
    >(config: TransitionConfig<State, C, E, Cm>): TransitionConfig<State, C, E, Cm> {
      return config
    },

    config<const Registry extends Implementations<Context, Event, Computed>>(registries: Registry) {
      return {
        /**
         * Build the config with all four name slots checked against the registries
         * from `.config(...)`. `initial` / `State` are inferred from `states`; the
         * registries are merged into `implementations` so `machine()` resolves the
         * names at runtime exactly as before.
         *
         * The guard/action/effect/delay name unions are inlined (rather than local
         * `type` aliases) so this method's inferred signature names no
         * function-local types — required by `--isolatedDeclarations`.
         */
        createMachine<State extends string>(
          config: Omit<
            TransitionConfig<
              State,
              Context,
              Event,
              Computed,
              keyof Registry['guards'] & AnyString,
              keyof Registry['actions'] & AnyString,
              keyof Registry['effects'] & AnyString,
              keyof Registry['delays'] & AnyString
            >,
            'implementations'
          >,
        ): TransitionConfig<State, Context, Event, Computed> {
          return { ...config, implementations: registries } as TransitionConfig<
            State,
            Context,
            Event,
            Computed
          >
        },
      }
    },
  }
}

/**
 * `setup` — the authoring entry point, with two symmetric paths that share the
 * same `.config(...).createMachine(...)` chain. The first step names the intent:
 *
 *   // infer: types inferred from the literal, no annotations needed
 *   const cfg = setup.infer().createMachine({ initial, context, states })
 *
 *   // as: you pin Context / Event, then names are compile-checked
 *   const { createMachine } = setup.as<Ctx, Ev, Computed>().config({ ... })
 *   createMachine({ ... })
 *
 * Why a chain instead of one call? TypeScript has no PARTIAL type-argument
 * inference — pass even one type arg and you must pass them all, inferring none.
 * Splitting the work across calls gives each its own inference site:
 *
 *   1. `setup.as<Ctx, Ev, Computed>()` — pin the machine types (they can't be
 *      inferred from a registry). `setup.infer()` skips this, leaving them to be
 *      inferred from the literal at `createMachine`.
 *   2. `.config(registries)` — infer the registry object (`const`, so keys stay
 *      literal); its callbacks are typed from step 1's Ctx/Ev.
 *   3. `.createMachine(config)` — the config, with every guard/action/effect/delay
 *      name now checked + autocompleted against step 2's keys.
 *
 * The checked chain in full:
 *
 *   const { createMachine } = setup.as<Ctx, Ev, Computed>().config({
 *     guards:  { isOpen: ({ context }) => context.open },
 *     actions: { setId:  ({ context }) => store.set(context.id) },
 *     effects: { track:  ({ send }) => store.subscribe(...) },
 *     delays:  { openDelay: ({ context }) => context.openMs },
 *   })
 *
 *   createMachine({
 *     initial: 'closed',
 *     context: { ... },
 *     states: {
 *       open: {
 *         entry:   ['setId'],            // ✅ checked against `actions`
 *         effects: ['track'],            // ✅ checked against `effects`
 *         after:   { openDelay: { ... } }, // ✅ checked against `delays` (numbers still ok)
 *         on: { close: { target: 'closed', guard: 'isOpen' } }, // ✅ checked against `guards`
 *       },
 *     },
 *   })
 *
 * `createMachine` returns the same `TransitionConfig` shape `machine()` consumes
 * (registries merged into `implementations`), so the rest of the pipeline is
 * unchanged.
 */
export const setup = {
  /** Infer `State` / `Context` / `Event` from the config literal — no annotations. */
  infer() {
    return chain<never, never, Record<string, never>>()
  },
  /** Pin `Context` / `Event` (/ `Computed`) explicitly; names become compile-checked via `.config(...)`. */
  as<
    Context extends object = never,
    Event extends { type: string } = never,
    Computed = Record<string, never>,
  >() {
    return chain<Context, Event, Computed>()
  },
}
