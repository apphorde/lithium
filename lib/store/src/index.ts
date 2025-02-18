import { valueRef, computedRef, type Ref } from '@li3/reactive';

export type Reducer<A, T = any> = (state: T, action: A) => T;
export type Effect<A, T = any> = (state: T, action: A) => void | Promise<void>;

export function createStore<
  State,
  Payload extends any,
  Actions extends Record<string, Reducer<Payload, State> | Effect<Payload, State>>,
>(initialState: State, actions: Actions) {
  const events = new EventTarget();
  const reducers = [];
  const effects = [];
  const state = valueRef(initialState);

  for (const next of Object.entries(actions)) {
    const type = Object.getPrototypeOf(next[1]).constructor === Function ? reducers : effects;
    type.push([next[0], next[1]]);
  }

  async function dispatch<K extends keyof Actions>(action: K, payload?: Actions[K] extends Reducer<infer P> ? P : any) {
    let nextState = { ...state.value };

    try {
      for (const reducer of reducers) {
        if (reducer[0] === action) {
          nextState = reducer[1](nextState, payload) ?? nextState;
        }
      }

      state.value = nextState;

      for (const effect of effects) {
        if (effect[0] === action) {
          await effect[1](state.value, payload);
        }
      }
    } catch (error) {
      events.dispatchEvent(new ErrorEvent('error', { error: String(error) }));
      return;
    }

    events.dispatchEvent(new CustomEvent('dispatch', { detail: { type: action, payload } }));
  }

  function get<V>(selector: (state: State) => V): V {
    return selector(state.value);
  }

  function select<V>(selector: (state: State) => V): Ref<V> {
    return computedRef(() => selector(state.value));
  }

  return { events, select, get, dispatch };
}
