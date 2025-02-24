import { describe, it, mock } from 'node:test';
import { createStore } from './index.js';
import assert from 'node:assert';

describe('store', () => {
  it('should create a store and dispatch actions', async () => {
    const { store, events, get } = createStore(
      { count: 0 },
      {
        increment: (state, payload: number) => ({ count: state.count + payload }),
        decrement: (state, payload: number) => ({ count: state.count - payload }),
        async incrementAsync(_state, payload: number) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          await store.increment(payload);
        },
      },
    );

    const callback = mock.fn();
    const count = (state) => state.count;
    events.addEventListener('dispatch', callback);

    await store.increment(1);
    assert.strictEqual(1, get(count), 'increment is incorrect');

    await store.decrement(1);
    assert.strictEqual(0, get(count), 'decrement is incorrect');

    await store.incrementAsync(5);
    assert.strictEqual(5, get(count), 'final state is incorrect');

    // 4 calls: 3 dispatches + 1 dispatch inside incrementAsync
    assert.strictEqual(4, callback.mock.callCount(), 'callback was not triggered correctly');
  });

  it('should not dispatch events until a state transition is commited', async () => {
    const { store, select, events, get, transaction } = createStore(
      { count: 0 },
      {
        increment(state, payload: number) {
          state.count += payload;
        },
        async incrementAsync(_state, payload: number) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          await store.increment(payload);
        },
      },
    );

    const selectorValue = select((state) => state.count);
    const onDispatch = mock.fn();
    const onCommit = mock.fn();
    const count = (state) => state.count;
    events.addEventListener('dispatch', onDispatch);
    events.addEventListener('commit', onCommit);

    assert.strictEqual(0, selectorValue.value, 'state change effect triggered');

    await transaction(async () => {
      await store.increment(1);
      assert.strictEqual(1, get(count), 'increment inside transaction has wrong value');

      await store.increment(10);
      assert.strictEqual(11, get(count), 'increment inside transaction has wrong value');

      await store.incrementAsync(100);
      assert.strictEqual(111, get(count), 'increment inside transaction has wrong value');
    });

    assert.strictEqual(111, selectorValue.value, 'state change effect not triggered');
    assert.strictEqual(111, get(count), 'transaction failed');
    assert.strictEqual(0, onDispatch.mock.callCount(), 'dispatch was emitted');
    assert.strictEqual(1, onCommit.mock.callCount(), 'commit was not emitted');
  });
});
