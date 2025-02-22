import { describe, it, mock } from 'node:test';
import { createStore } from './index.js';
import assert from 'node:assert';

describe('store', () => {
  // it('should create a store and dispatch actions', async () => {
  //   const store = createStore(
  //     { count: 0 },
  //     {
  //       increment: (state, payload: number) => ({ count: state.count + payload }),
  //       decrement: (state, payload: number) => ({ count: state.count - payload }),
  //       async incrementAsync(_state, payload: number) {
  //         await new Promise((resolve) => setTimeout(resolve, 1000));
  //         await store.dispatch('increment', payload);
  //       },
  //     },
  //   );

  //   const callback = mock.fn();
  //   const count = (state) => state.count;
  //   store.events.addEventListener('dispatch', callback);

  //   store.dispatch('increment', 1);
  //   assert.strictEqual(1, store.get(count), 'increment is incorrect');

  //   store.dispatch('decrement', 1);
  //   assert.strictEqual(0, store.get(count), 'decrement is incorrect');

  //   await store.dispatch('incrementAsync', 5);
  //   assert.strictEqual(5, store.get(count), 'final state is incorrect');

  //   // 4 calls: 3 dispatches + 1 dispatch inside incrementAsync
  //   assert.strictEqual(4, callback.mock.callCount(), 'callback was not triggered correctly');
  // });

  it('should not dispatch events until a state transition is commited', async () => {
    const store = createStore(
      { count: 0 },
      {
        increment: (state, payload: number) => ({ count: state.count + payload }),
        async incrementAsync(_state, payload: number) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await store.dispatch('increment', payload);
        },
      },
    );

    const onDispatch = mock.fn();
    const onCommit = mock.fn();
    const count = (state) => state.count;
    store.events.addEventListener('dispatch', onDispatch);
    store.events.addEventListener('commit', onCommit);

    await store.transaction(async () => {
      await store.dispatch('increment', 1);
      assert.strictEqual(1, store.get(count), 'increment happened inside transaction');

      await store.dispatch('increment', 10);
      assert.strictEqual(11, store.get(count), 'increment happened inside transaction');

      await store.dispatch('incrementAsync', 100);
      assert.strictEqual(111, store.get(count), 'increment happened inside transaction');
    });

    assert.strictEqual(111, store.get(count), 'transaction failed');
    assert.strictEqual(0, onDispatch.mock.callCount(), 'dispatch was emitted');
    assert.strictEqual(1, onCommit.mock.callCount(), 'commit was not emitted');
  });
});
