import { valueRef, computedRef, type Ref } from '@li3/reactive';

type Action<Args, T = any> = (state: T, ...args: Args[]) => void | Promise<void> | Promise<T> | T;
type ActionParameters<T> = T extends (state: any, ...args: infer P) => any ? P : never;

export function createStore<State, Payload extends any, Actions extends Record<string, Action<Payload, State>>>(
  initialState: State,
  actions: Actions,
) {
  const events = new EventTarget();
  const state = valueRef(initialState);
  const transaction = { active: false, state: null as State | null };
  const getState = () => (transaction.active ? transaction.state : state.value);
  const setState = (s: State) => (transaction.active ? (transaction.state = s) : (state.value = s));

  async function dispatch<K extends keyof Actions>(
    action: K,
    payload?: Actions[K] extends Action<infer P> ? P : any,
  ): Promise<void> {
    try {
      const current = transaction.active ? transaction.state : state.value;
      const response = await actions[action](current, payload as Payload);

      console.log(transaction.active, action, payload, response);
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
  }

  function select<V>(selector: (state: State) => V): Ref<V> {
    return computedRef(() => selector(state.value));
  }

  function get<V>(selector: (state: State) => V): V {
    return selector(getState());
  }

  async function startTransaction(handler: () => any) {
    try {
      transaction.active = true;
      transaction.state = { ...state.value };
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
  }

  const entries = Object.keys(actions);
  const actionMap = Object.fromEntries(entries.map((key) => [key, dispatch.bind(null, key)])) as {
    [K in keyof Actions]: (...args: ActionParameters<Actions[K]>) => any;
  };

  return {
    events,
    select,
    get,
    transaction: startTransaction,
    store: actionMap,
  };
}
