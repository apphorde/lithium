import { valueRef, computedRef, type Ref } from '@li3/reactive';

export type Action<A, T = any> = (state: T, action: A) => void | Promise<void> | Promise<T> | T;

export function createStore<State, Payload extends any, Actions extends Record<string, Action<Payload, State>>>(
  initialState: State,
  actions: Actions,
) {
  const events = new EventTarget();
  const state = valueRef(initialState);
  const transaction = { active: false, state: null as State | null };
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
    async dispatch<K extends keyof Actions>(action: K, payload?: Actions[K] extends Action<infer P> ? P : any): Promise<void> {
      if (!actions[action]) {
        return;
      }

      try {
        const current = transaction.active ? transaction.state : state.value;
        const response = await actions[action](current, payload as Payload);

        console.log(transaction.active, action, payload, response)
        if (response) {
          setState({ ...response });
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
