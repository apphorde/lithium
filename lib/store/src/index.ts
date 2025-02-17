// import { onDestroy } from "@li3/runtime";
import { observer, ref, Ref } from '@li3/reactive';

const noop = () => {};
const identity = (s) => s;

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
  const state = { value: initialState };

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

  function addReducer(type: string, fn: Reducer<A, T>) {
    reducers.push([type, fn]);
  }

  function addEffect(type: string, fn: Effect<A, T>) {
    effects.push([type, fn]);
  }

  if (options?.reducers) {
    for (const next of Object.entries(options?.reducers)) {
      addReducer(next[0], next[1]);
    }
  }

  if (options?.effects) {
    for (const next of Object.entries(options?.effects)) {
      addEffect(next[0], next[1]);
    }
  }

  function useSelectors() {
    const observers = [];

    function check() {
      for (const f of observers) f();
    }

    events.addEventListener('dispatch', check);

    function detach() {
      observers.length = 0;
      events.removeEventListener('dispatch', check);
    }

    function select<V>(selector: (state: T) => V = identity): Ref<V> {
      const value = selector(state.value);
      const valueRef = ref(value, noop);
      const o = observer(
        () => selector(state.value),
        (value) => (valueRef.value = value),
      );

      observers.push(o);

      return valueRef;
    }

    // onDestroy(detach);

    return { detach, select };
  }

  return { events, useSelectors, dispatch, addReducer, addEffect };
}
