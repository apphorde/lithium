import { FF } from './feature-flags.js';
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
const dirtyTag = Symbol('%');

function canBeObserved(object: any): boolean {
  return object !== null && object !== undefined && typeof object === 'object' && !object[reactiveTag];
}

function reactive<T extends object>(object: T, effect: AnyFunction): T {
  if (!canBeObserved(object)) {
    return object;
  }

  const values = Object.entries(object);

  for (const [key, next] of values) {
    if (typeof next === 'object' && next !== null) {
      (object as any)[key] = reactive(next, effect);
    }
  }

  let dirty = false;

  return new Proxy(object, {
    get(target: any, p) {
      if (p === reactiveTag) {
        return true;
      }

      if (p === unwrapTag) {
        return object;
      }

      if (p === dirtyTag) {
        return dirty;
      }

      return target[p];
    },

    set(target: any, p, value) {
      if (p === dirtyTag) {
        if (FF.debug) console.log('dirtyTag');
        return (dirty = true);
      }

      if (FF.reactiveEq && target[p] === value) return true;
      if (compare(target[p], value)) return true;

      target[p] = canBeObserved(value) ? reactive(value, effect) : value;
      effect();

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
  const notify = () => {
    notifyDependencies(o);
  };

  const reactiveEffect = () => {
    const isArray = Array.isArray(o.internalValue);

    if (isArray) {
      o.internalValue[dirtyTag] = true;
    }

    notify();

    if (isArray) {
      o.internalValue[dirtyTag] = false;
    }
  };

  const o: SignalInternal = {
    [refSymbol]: true,
    internalValue: !isShallow && canBeObserved(initial) ? reactive(initial as object, reactiveEffect) : initial,
    dependencies: new Set(),
    watchers: new Set(),

    get value() {
      captureDependency(o);
      return o.internalValue;
    },

    set value(newValue) {
      o.update(newValue);
    },

    update(newValue?: T) {
      if (FF.refEq && o.internalValue === newValue) return;
      if (compare(o.internalValue, newValue)) return;

      if (!isShallow && canBeObserved(newValue)) {
        newValue = reactive(newValue as object, reactiveEffect) as T;
      }

      o.internalValue = newValue;

      notify();
    },
  };

  return o as Signal<T>;
}

function isDirty(v: any): boolean {
  return v && v[dirtyTag];
}

function shallowRef<T>(value?: T) {
  return ref<T>(value, true);
}

function isRef(t: any): t is Signal {
  return Boolean(t && t[refSymbol]);
}

function computed<T = any>(fn: () => T): Signal<T> {
  const o: SignalInternal<T> = {
    [refSymbol]: true,
    internalValue: undefined as T,
    dependencies: new Set(),
    watchers: new Set(),

    get value() {
      captureDependency(o);
      return o.internalValue;
    },

    set value(_) {
      throw new Error('Computed value cannot be set');
    },

    update() {
      const value = fn();

      if (FF.computedEq && o.internalValue === value) return;
      if (compare(o.internalValue, value)) return;

      o.internalValue = value;
      notifyDependencies(o);
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

  return o as Signal<T>;
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
  for (const dep of target.dependencies) {
    dep.update();
  }

  if (!target.watchers.size) return;

  const value = target.value;

  for (const watcher of target.watchers) {
    watcher(value);
  }
}

function memoizedWatcher<T>(watcher: AnyFunction) {
  let lastValue: T | undefined;

  // NOTE: never compare values for watchers!
  // ref() and computed() already skip watchers if
  // new and old values are the same
  return function (value: T) {
    lastValue = value;
    watcher(value, lastValue);
  };
}

function captureDependency(o: SignalInternal) {
  const d = signalsStack.at(-1);

  if (d && d !== o) {
    o.dependencies.add(d);
  }
}

export { ref, computed, effect, watch, reactive, unwrap, isRef, isDirty, shallowRef, canBeObserved };
