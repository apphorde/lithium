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

  let transaction = { active: false, state: null as State | null };
  const getState = () => (transaction.active ? transaction.state : state.value);
  const setState = (s: State) => (transaction.active ? (transaction.state = s) : (state.value = s));

  return {
    events,
    select<V>(selector: (state: State) => V): Ref<V> {
      return computedRef(() => selector(state.value));
    },
    get<V>(selector: (state: State) => V): V {
      return selector(getState());
    },
    async dispatch<K extends keyof Actions>(action: K, payload?: Actions[K] extends Reducer<infer P> ? P : any) {
      let nextState = transaction.active ? transaction.state : state.value;

      try {
        for (const reducer of reducers) {
          if (reducer[0] === action) {
            nextState = reducer[1](nextState, payload) ?? nextState;
          }
        }

        setState(nextState);

        for (const effect of effects) {
          if (effect[0] === action) {
            // FIXME effects can still mutate state
            await effect[1](getState(), payload);
          }
        }
      } catch (error) {
        if (!transaction.active) {
          events.dispatchEvent(new CustomEvent('error', { detail: String(error) }));
        }
        return;
      }

      if (!transaction.active) {
        events.dispatchEvent(new CustomEvent('dispatch', { detail: { type: action, payload } }));
      }
    },

    async transaction(handler: () => any) {
      try {
        transaction.active = true;
        transaction.state = state.value;
        await handler();
        transaction.active = false;
        state.value = transaction.state;
        events.dispatchEvent(new CustomEvent('commit', { detail: state.value }));
      } catch (error) {
        events.dispatchEvent(new CustomEvent('error', { detail: String(error) }));
      } finally {
        transaction.active = false;
        transaction.state = null;
      }
    },
  };
}
