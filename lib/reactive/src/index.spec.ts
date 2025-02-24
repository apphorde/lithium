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

describe('computed and value ref', () => {
  it('should observe a change in a computed value', async () => {
    const values = [];
    const callback = (v) => values.push(v);
    const source1 = valueRef(1);
    const source2 = valueRef(10);
    const computed1 = computedRef(() => source1.value + source2.value, callback);
    const computed2 = computedRef(() => source1.value + computed1.value, callback);

    assert.strictEqual(11, computed1.value, 'computed1 ref value is incorrect');
    assert.strictEqual(12, computed2.value, 'computed2 ref value is incorrect');
    assert.deepStrictEqual(values, [11, 12], 'callback was not triggered correctly');

    values.length = 0;
    source1.value = 5;
    assert.strictEqual(15, computed1.value, 'computed1 ref value is incorrect after dependency change');
    assert.deepStrictEqual(values, [15, 20], 'callback was not triggered correctly');

    source2.value = 5;
    assert.strictEqual(10, computed1.value, 'computed1 ref value is incorrect after dependency change');
    assert.strictEqual(15, computed2.value, 'computed2 ref value is incorrect after dependency change');
  });
});
