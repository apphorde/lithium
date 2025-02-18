import { valueRef } from '@li3/reactive';
import { computedEffect } from './index.js';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { RuntimeContext } from '@li3/runtime';

describe('computedEffect', () => {
  it('should observe a change in an object', () => {
    const callback = mock.fn();
    const name = valueRef('Bob');
    const context = new RuntimeContext({
      element: {} as any,
      setup() {
        return {
          name
        }
      }
    });

    const ref = computedEffect(context, 'name', callback);
    assert.strictEqual(ref.value, 'Bob');
    assert.strictEqual(callback.mock.calls.length, 1);
  });
});
