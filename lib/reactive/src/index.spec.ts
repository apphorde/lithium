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
  it('should observe a change in a computed value', () => {
    const callback = mock.fn();
    const source1 = valueRef(1);
    const source2 = valueRef(2);
    const computed = computedRef(() => source1.value + source2.value, callback);

    assert.strictEqual(3, computed.value, 'computed ref value is incorrect');
    assert.strictEqual(1, callback.mock.callCount(), 'callback was not triggered correctly');

    source1.value = 3;
    assert.strictEqual(5, computed.value, 'computed ref value is incorrect after dependency change');
    assert.strictEqual(2, callback.mock.callCount(), 'callback was not triggered correctly');

    source2.value = 3;
    assert.strictEqual(6, computed.value, 'computed ref value is incorrect after dependency change');
    assert.strictEqual(3, callback.mock.callCount(), 'callback was not triggered correctly');
  });
});
