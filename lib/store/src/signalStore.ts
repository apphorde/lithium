import { type Signal, type Effect, effect } from "@li3/reactive";
// import { Plugins } from '@li3/runtime';

type SignalOrEffect<T> = Signal<T> | Effect<T>;
type AnyFunction = (...args: any[]) => unknown;
type StoreSignals<T> = Record<string, Signal<T> | Effect<T>>;
type StoreMethods<T extends AnyFunction> = Record<string, T>;
type FactoryFunction<T, S extends SignalOrEffect<T>, F extends AnyFunction> = () => StoreSignals<S> & StoreMethods<F>;
type Store<T> = Record<string, AnyFunction | SignalOrEffect<T>>;

const storeMap = new Map<string, Store<any>>();

/**
 * Stores have signals and methods to interact with them.
 * A factory function should create signals and methods and return them as an object.
 *
 * TODO pass other stores as dependency to factory
 * @param
 * @param factory
 */
export function createStore<T, S, F extends AnyFunction>(name: string, factory: FactoryFunction<T, S, F>) {
  if (storeMap.has(name)) {
    throw new Error("Store already exists");
  }

  storeMap.set(name, makeStore(factory));
}

function makeStore<T, S, F extends AnyFunction>(factory: FactoryFunction<T, S, F>) {
  const { state, methods } = factory();
  const view = {};

  for (const k of Object.keys(state)) {
    Object.defineProperty(view, k, {
      get() {
        return state[k].value;
      },
    });
  }

  return { methods, state: view };
}

export function useStore(store) {
  const effects = [];
  const { state, methods } = store;

  // onDestroy(function () {
  //   for (const f of effects) f.dispose();
  // });

  function select(f) {
    const $ = effect(() => f(state));
    effects.push($);
    return $;
  }

  return { store: methods, select };
}
