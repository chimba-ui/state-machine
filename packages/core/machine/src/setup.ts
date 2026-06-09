import type { Implementations, TransitionConfig, AnyString } from './types'

/**
 * `setup()` — author a config with its named impls CHECKED.
 *
 * A plain `config({ states, implementations })` types every `guard` / action /
 * effect / `after`-delay name as a loose string: a typo compiles and only throws
 * at runtime. The reason it can't do better is ordering — `states` and
 * `implementations` infer simultaneously in one object, so neither can constrain
 * the other's names.
 *
 * `setup` breaks that into two steps so the registries are known FIRST:
 *
 *   const { createMachine } = setup<Ctx, Ev, Computed>()({
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
 * A typo in any of those names is now a COMPILE error with autocomplete, not a
 * runtime throw. `createMachine` returns the same `TransitionConfig` shape `machine()`
 * consumes (with the registries merged into `implementations`), so the rest of the
 * pipeline is unchanged.
 *
 * Curried in three steps because each fixes generics the next can't infer:
 *   1. `setup<Ctx, Ev, Computed>()` — pin the machine types (they can't be inferred
 *      from a registry, so they're explicit, like `config`'s).
 *   2. `(registries)` — infer the registry object (`const`, so keys stay literal).
 *   3. `.createMachine(config)` — the config, now name-checked against step 2's keys.
 */
export function setup<
  Context extends object,
  Event extends { type: string },
  Computed = Record<string, never>,
>() {
  return function registries<const Registry extends Implementations<Context, Event, Computed>>(
    impls: Registry,
  ) {
    type GuardName = keyof Registry['guards'] & AnyString
    type ActionName = keyof Registry['actions'] & AnyString
    type EffectName = keyof Registry['effects'] & AnyString
    type DelayName = keyof Registry['delays'] & AnyString

    return {
      /**
       * Build the config with all four name slots checked against the registries
       * supplied above. `initial` / `State` are inferred from `states`; the
       * registries are merged into `implementations` so `machine()` resolves the
       * names at runtime exactly as before.
       */
      createMachine<State extends string>(
        config: Omit<
          TransitionConfig<
            State,
            Context,
            Event,
            Computed,
            GuardName,
            ActionName,
            EffectName,
            DelayName
          >,
          'implementations'
        >,
      ): TransitionConfig<State, Context, Event, Computed> {
        return { ...config, implementations: impls } as TransitionConfig<
          State,
          Context,
          Event,
          Computed
        >
      },
    }
  }
}
