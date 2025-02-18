// import { onDestroy } from "@li3/runtime";
import { valueRef, computedRef, Ref } from '@li3/reactive';

export interface Action<T = any> {
  type: string;
  payload?: T;
}

export type Reducer<A, T> = (action: A, state: T) => T;
export type Effect<A, T> = (action: A, state: T) => void | Promise<void>;
export interface StoreOptions {
  reducers?: Record<string, Reducer<any, any>>;
  effects?: Record<string, Reducer<any, any>>;
}

export function createStore<T, A extends Action>(initialState: T, options?: StoreOptions) {
  const events = new EventTarget();
  const reducers = [];
  const effects = [];
  const state = valueRef(initialState);

  function dispatch(action: A | string, payload?: any) {
    if (typeof action === 'string') {
      action = { type: action, payload } as A;
    }

    let nextState = { ...state.value };

    try {
      for (const reducer of reducers) {
        if (reducer[0] === action.type) {
          nextState = reducer[1](nextState, action) ?? nextState;
        }
      }

      state.value = nextState;

      for (const effect of effects) {
        if (effect[0] === action.type) {
          effect[1](nextState, action);
        }
      }
    } catch (error) {
      events.dispatchEvent(new ErrorEvent('error', { error: String(error) }));
      return;
    }

    events.dispatchEvent(new CustomEvent('dispatch', { detail: action }));
  }

  if (options?.reducers) {
    for (const next of Object.entries(options?.reducers)) {
      reducers.push([next[0], next[1]]);
    }
  }

  if (options?.effects) {
    for (const next of Object.entries(options?.effects)) {
      effects.push([next[0], next[1]]);
    }
  }

  // events.addEventListener('dispatch', () => state.check());

  function select<V>(selector: (state: T) => V): Ref<V> {
    return computedRef(() => selector(state.value));
  }

  return { events, select, dispatch };
}
