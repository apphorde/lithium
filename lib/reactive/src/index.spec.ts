import { reactive, computedRef, valueRef } from './index.js';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

describe('reactive values', () => {
  it('should observe a change in an object', () => {
    const callback = mock.fn();
    const target = {
      name: 'Alice',
      address: { street: '', number: 1 },
    };

    const reactiveObject = reactive(target, callback);

    // any value assigned to target object triggers a callback, recursively
    reactiveObject.name = 'Bob';
    reactiveObject.address = { street: '1 Main St', number: 123 };
    reactiveObject.address.number = 456;

    assert.strictEqual(3, callback.mock.callCount(), 'callback was not triggered correctly');
  });
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('computed and value ref', () => {
  it('should observe a change in a computed value', async () => {
    const values = [];
    const callback = (v) => values.push(v);
    const source1 = valueRef(1);
    const source2 = valueRef(2);
    const computed1 = computedRef(async () => source1.value + source2.value, callback);
    const computed2 = computedRef(() => source1.value + computed1.value, callback);

    await delay(10);
    assert.strictEqual(3, computed1.value, 'computed1 ref value is incorrect');
    assert.strictEqual(4, computed2.value, 'computed2 ref value is incorrect');
    assert.deepStrictEqual(values, [3, 4], 'callback was not triggered correctly');

    values.length = 0;
    source1.value = 3;
    await delay(10);
    assert.strictEqual(5, computed1.value, 'computed1 ref value is incorrect after dependency change');
    assert.deepStrictEqual(values, [5, 6, 8], 'callback was not triggered correctly');

    source2.value = 3;
    await delay(10);
    assert.strictEqual(6, computed1.value, 'computed1 ref value is incorrect after dependency change');
    assert.strictEqual(9, computed2.value, 'computed2 ref value is incorrect after dependency change');
  });
});
