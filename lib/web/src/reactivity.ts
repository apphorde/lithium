import { compare } from './compare.js';
import type { AnyFunction } from './types';

export type Signal<T = any> = {
  value: T;
};

type SignalInternal<T = any> = Signal<T> & {
  [refSymbol]: true;
  internalValue: T;
  dependencies: Set<SignalInternal>;
  watchers: Set<AnyFunction>;
  update(value?: T): void;
};
const signalsStack: SignalInternal[] = [];
const reactiveTag = Symbol('!');
const unwrapTag = Symbol('[]');
const refSymbol = Symbol('$');

function canBeObserved(object: any): boolean {
  return (
    object !== null &&
    object !== undefined &&
    typeof object === 'object' &&
    !object[reactiveTag]
  );
}

function reactive<T extends object>(object: T, effect: AnyFunction, notifier?: SignalInternal): T {
  if (!canBeObserved(object)) {
    return object;
  }

  const values = Object.entries(object);

  for (const [key, next] of values) {
    if (typeof next === 'object' && next !== null) {
      (object as any)[key] = reactive(next, effect, notifier);
    }
  }

  return new Proxy(object, {
    get(target: any, p) {
      if (p === reactiveTag) {
        return true;
      }

      if (p === unwrapTag) {
        return object;
      }

      if (notifier) {
        capture(notifier);
      }

      return target[p];
    },

    set(target: any, p, value, receiver) {
      if (!compare(target[p], value)) {
        Reflect.set(target, p, reactive(value, effect, notifier), receiver);
        effect();
      }

      return true;
    },

    deleteProperty(target: any, p) {
      delete target[p];
      effect();
      return true;
    },
  });
}

function unwrap<T = any>(object: T): T {
  if (object === null || object === undefined) {
    return object;
  }

  if ((object as any)[unwrapTag]) {
    return (object as any)[unwrapTag];
  }

  if (isRef(object)) {
    return object.value;
  }

  return object;
}

function ref<T>(initial?: T, isShallow?: boolean): Signal<T>;
function ref<T = any>(initial: T | undefined, isShallow = false) {
  function reactiveEffect() {
    if (!isShallow && Array.isArray(o.internalValue)) {
      o.internalValue = reactive(o.internalValue, reactiveEffect, o) as T;
    }

    notifyDependencies(o);
  };

  const o: SignalInternal = {
    [refSymbol]: true,
    internalValue: undefined as T,
    dependencies: new Set(),
    watchers: new Set(),

    get value() {
      capture(o);
      return o.internalValue;
    },

    set value(newValue) {
      o.update(newValue);
    },

    update(newValue?: T) {
      if (compare(o.internalValue, newValue)) return;

      if (!isShallow) {
        newValue = reactive(newValue as object, reactiveEffect, o) as T;
      }

      o.internalValue = newValue;

      notifyDependencies(o);
    },
  };

  o.internalValue = !isShallow ? reactive(initial as object, reactiveEffect, o) : initial;

  return o as Signal<T>;
}

function computed<T = any>(fn: () => T): Signal<T> {
  const o: SignalInternal<T> = {
    [refSymbol]: true,
    internalValue: undefined as T,
    dependencies: new Set(),
    watchers: new Set(),

    get value() {
      capture(o);
      return o.internalValue;
    },

    set value(_) {
      throw new Error('Computed value cannot be set');
    },

    update() {
      const value = fn();

      if (!compare(o.internalValue, value)) {
        o.internalValue = value;
        notifyDependencies(o);
      }
    },
  };

  signalsStack.push(o);

  try {
    o.update();
  } catch (e) {
    console.error(e);
  } finally {
    signalsStack.pop();
  }

  (o as any).fn = fn;
  return o as Signal<T>;
}

function shallowRef<T>(value?: T) {
  return ref<T>(value, true);
}

function isRef(t: any): t is Signal {
  return Boolean(t && t[refSymbol]);
}

function watch(target: Signal, fn: AnyFunction) {
  const memoized = memoizedWatcher(fn);
  const watchers = (target as SignalInternal).watchers;
  watchers.add(memoized);
  memoized(target.value);

  return () => {
    watchers.delete(memoized);
  };
}

function effect(fn: AnyFunction, effectFn: AnyFunction) {
  return watch(computed(fn), effectFn);
}

function notifyDependencies(target: SignalInternal) {
  const value = target.value;

  for (const dep of target.dependencies) {
    dep.update();
  }

  for (const watcher of target.watchers) {
    watcher(value);
  }
}

function capture(o: SignalInternal) {
  const d = signalsStack.length && signalsStack.at(-1);
  if (d && d !== o) {
    o.dependencies.add(d);
  }
}

function memoizedWatcher<T>(watcher: AnyFunction) {
  let lastValue: T | undefined;

  // NOTE: we never compare values for watchers!
  // ref() and computed() already skip watchers if
  // new and old values are the same
  return function (value: T) {
    watcher(value, lastValue);
    lastValue = value;
  };
}

export { ref, computed, effect, watch, reactive, unwrap, isRef, shallowRef, canBeObserved };
