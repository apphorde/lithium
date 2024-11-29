import { observer, ref, Ref } from "@lithium/reactive";

const noop = () => {};

export interface Action<T = any> {
  type: string;
  payload?: T;
}

export type Reducer<A, T> = (action: A, state: T) => T;
export type Effect<A, T> = (action: A, state: T) => void | Promise<void>;

export function useStore<T, A extends Action>(initialState: T) {
  const events = new EventTarget();

  function check() {
    for (const f of observers) f();
  }

  const observers = [];
  const reducers = [];
  const effects = [];
  const state = ref<T>(initialState, check);
  const selectAll = (state) => state;

  function select<V>(selector: (state: T) => V = selectAll): Ref<V> {
    const v = selector(state.value);
    const s = ref(v, noop);

    const o = observer(
      () => selector(state.value),
      (value) => (s.value = value)
    );

    observers.push(o);

    return s;
  }

  function dispatch(action: A) {
    let next = structuredClone(state.value);

    try {
      for (const reducer of reducers) {
        if (reducer[0] === action.type) {
          next = reducer[1](next, action);
        }
      }

      state.value = next;

      for (const effect of effects) {
        if (effect[0] === action.type) {
          effect[1](next, action);
        }
      }
    } catch (error) {
      events.dispatchEvent(new ErrorEvent("error", { error: String(error) }));
      return;
    }

    events.dispatchEvent(new CustomEvent("dispatch", { detail: action }));
  }

  function withReducer(type: string, fn: Reducer<A, T>) {
    reducers.push([type, fn]);
  }

  function withEffect(type: string, fn: Effect<A, T>) {
    effects.push([type, fn]);
  }

  return { events, select, dispatch, withReducer, withEffect };
}
