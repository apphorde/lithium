import { valueRef } from '@li3/reactive';
import { computedEffect } from './index.js';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createRuntimeContext, createState, setOption } from '@li3/runtime';

setOption('useModuleExpressions', false);
setOption('useDomParser', false);

describe('computedEffect', () => {
  it('should observe a change in an object', async () => {

    const callback = mock.fn();
    const name = valueRef('Bob');
    const context = createRuntimeContext({
      element: {} as any,
      setup() {
        return {
          name
        }
      }
    });

    createState(context);
    const ref = computedEffect(context, 'name', callback);
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.strictEqual(ref.value, 'Bob');
    assert.strictEqual(callback.mock.calls.length, 1);
  });
});
