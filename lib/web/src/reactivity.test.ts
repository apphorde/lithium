import { describe, it, vi, expect, beforeEach } from 'vitest';
import { ref, computed, watch, effect, reactive, isRef, unwrap, canBeObserved } from './reactivity.js';

beforeEach(() => {
  beforeEach(() => {
    function toNodeModule(code: Blob) {
      return `data:text/javascript;base64,${(globalThis as any).Buffer.from(code).toString('base64')}`;
    }

    Object.assign(window, {
      URL: class {
        static createObjectURL(code: Blob) {
          return toNodeModule(code);
        }
      },
      Blob: class {
        constructor() {}
      },
    });
  });
});

describe('reactivity', () => {
  describe('ref', () => {
    it('should create a reactive reference to a value', () => {
      const r = ref(1);
      expect(r.value).toBe(1);
      r.value = 2;

      expect(r.value).toBe(2);
      expect(isRef(r)).toBe(true);
      expect(isRef({})).toBe(false);
    });

    it('should hold undefined by default', () => {
      const r = ref();
      expect(r.value).toBeUndefined();
    });
  });

  describe('canBeObserved', () => {
    it('returns false for null and primitive values, and true for objects', () => {
      expect(canBeObserved(null)).toBe(false);
      expect(canBeObserved(undefined)).toBe(false);
      expect(canBeObserved(123)).toBe(false);
      expect(canBeObserved('text')).toBe(false);
      expect(canBeObserved({})).toBe(true);
      expect(canBeObserved([])).toBe(true);
    });
  });

  describe('computed', () => {
    it('should create a computed property that updates when dependencies change', async () => {
      const a = ref(1);
      const b = ref(2);
      const fn = vi.fn().mockImplementation(() => a.value + b.value);
      const c = computed(fn);

      expect(c.value).toBe(3);
      expect(fn.mock.calls.length).toBe(1);

      a.value = 3;
      expect(c.value).toBe(5);
      expect(fn.mock.calls.length).toBe(2);
      expect(() => ((c as any).value = 0)).toThrow();

      const seen: any[] = [];
      const unsub = watch(a, (v: any) => seen.push(v));

      a.value = 4;
      unsub();

      a.value = 5;
      expect(seen.length).toBeGreaterThanOrEqual(2);

      const eff: any[] = [];
      effect(
        () => a.value * 2,
        (v: any) => eff.push(v),
      );
      a.value = 10;
      expect(eff.length).toBeGreaterThan(0);
    });

    it('should not recompute if dependencies do not change', () => {
      const a = ref(1);
      const fn = vi.fn().mockImplementation(() => a.value * 2);
      const c = computed(fn);

      expect(c.value).toBe(2);
      expect(fn.mock.calls.length).toBe(1);

      // Accessing the computed value again should not trigger recomputation
      expect(c.value).toBe(2);
      expect(fn.mock.calls.length).toBe(1);

      // Changing the dependency should trigger recomputation
      a.value = 3;
      expect(c.value).toBe(6);
      expect(fn.mock.calls.length).toBe(2);
    });
  });

  describe('effect', () => {
    it('runs effect functions when dependencies change', () => {
      const object = ref({ number: 2 });
      const fn = vi.fn();

      effect(() => object.value.number * 3, fn);

      expect(fn.mock.calls.length).toBe(1);
      expect(fn.mock.calls[0][0]).toBe(6);
      object.value.number = 3;

      expect(fn.mock.calls.length).toBe(2);
      expect(fn.mock.calls[1][0]).toBe(9);

      object.value = { number: 3 };
      expect(fn.mock.calls.length).toBe(2);
    });
  });

  describe('isRef', () => {
    it('identifies refs and computed values as refs', () => {
      const r = ref(1);
      const c = computed(() => r.value + 1);
      expect(isRef(r)).toBe(true);
      expect(isRef(c)).toBe(true);
      expect(isRef({})).toBe(false);
    });
  });

  describe('reactive', () => {
    it('should observe changes in an object', async () => {
      const o: any = { a: 1, b: { c: 2 } };
      let changes = 0;
      const p = reactive(o, () => changes++);

      p.a = 2;
      p.b.c = 4;
      delete p.a;
      expect(changes).toBe(3);

      // watch newly added objects
      p.a = { c: 1 };
      expect(changes).toBe(4);

      p.a.c = 2;
      expect(changes).toBe(5);
    });
  });

  describe('unwrap', () => {
    it('returns raw values for non-reactive objects', () => {
      const raw = { a: 1 };
      expect(unwrap(raw)).toBe(raw);
      expect(unwrap(null)).toBeNull();
      expect(unwrap(undefined)).toBeUndefined();
      expect(unwrap(ref(1))).toBe(1);
    });
  });

  describe('watch', () => {
    it('invokes callback when watched value changes', () => {
      const r = ref(1);
      const seen: any[] = [];
      const unsub = watch(r, (next) => seen.push(next));
      expect(seen[0]).toBe(1);
      r.value = 2;
      expect(seen[seen.length - 1]).toBe(2);
      unsub();
    });
  });

  describe('reactivity with nested objects', () => {
    it('should observe changes in nested objects', () => {
      const context = ref({
        items: [
          { name: '', address: { street: '1st Ave' } }
        ]
      });
      const output = { street: '', name: '' };
      const items = computed(() => context.value.items[0]);
      effect(() => items.value.name, (next) => output.name = next);

      context.value.items[0].name = 'John';
      expect(output.name).toBe('John');

      effect(() => items.value.address.street, (next) => output.street = next);
      context.value.items[0].address.street = '2nd Ave';
      expect(output.street).toBe('2nd Ave');

      context.value.items = [];

      expect(output.name).toBe(null);
      expect(output.street).toBe(null);

      context.value.items.push({ name: 'Jane', address: { street: '3rd Ave' } });
      expect(output.name).toBe('Jane');
      expect(output.street).toBe('3rd Ave');
    });
  });
});
