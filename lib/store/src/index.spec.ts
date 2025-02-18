import { describe, it, mock } from 'node:test';
import { createStore } from './index.js';
import assert from 'node:assert';

describe('store', () => {
  it('should create a store and dispatch actions', async () => {
    const store = createStore(
      { count: 0 },
      {
        increment: (state, payload: number) => ({ count: state.count + payload }),
        decrement: (state, payload: number) => ({ count: state.count - payload }),
        async incrementAsync(_state, payload: number) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await store.dispatch('increment', payload);
        },
      },
    );

    const callback = mock.fn();
    const count = (state) => state.count;
    store.events.addEventListener('dispatch', callback);

    store.dispatch('increment', 1);
    assert.strictEqual(1, store.get(count), 'increment is incorrect');

    store.dispatch('decrement', 1);
    assert.strictEqual(0, store.get(count), 'decrement is incorrect');

    await store.dispatch('incrementAsync', 5);
    assert.strictEqual(5, store.get(count), 'final state is incorrect');

    // 4 calls: 3 dispatches + 1 dispatch inside incrementAsync
    assert.strictEqual(4, callback.mock.callCount(), 'callback was not triggered correctly');
  });
});
