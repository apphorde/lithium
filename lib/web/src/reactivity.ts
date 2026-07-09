import { compare } from './compare.js';
import { FF } from './feature-flags.js';
import type { AnyFunction } from './types';

const refList = new Set();
(window as any)['refList'] = refList;

export type Signal<T = any> = {
  value: T;
};

type SignalInternal<T = any> = Signal<T> & {
  [refTag]: true;
  internalValue: T;
  dependencies: Set<SignalInternal>;
  watchers: Set<AnyFunction>;
  suspended: boolean;
  update(value?: T): void;
};
const signalsStack: SignalInternal[] = [];
const reactiveTag = Symbol('#');
const unwrapTag = Symbol('[]');
const refTag = Symbol('$');

function canBeObserved(object: any): boolean {
  return object !== null && object !== undefined && typeof object === 'object' && !object[reactiveTag];
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
  }

  const o: SignalInternal = {
    [refTag]: true,
    suspended: false,
    internalValue: undefined as T,
    dependencies: new Set<SignalInternal>(),
    watchers: new Set(),

    get value() {
      capture(o);
      return o.internalValue;
    },

    set value(newValue) {
      if (o.suspended) return;
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

  if (FF.debug) refList.add(new WeakRef(o));

  return o as Signal<T>;
}

function computed<T = any>(fn: () => T): Signal<T> {
  const o: SignalInternal<T> = {
    [refTag]: true,
    suspended: false,
    internalValue: undefined as T,
    dependencies: new Set<SignalInternal>(),
    watchers: new Set(),

    get value() {
      capture(o);
      return o.internalValue;
    },

    set value(_) {
      throw new Error('Computed value cannot be set');
    },

    update() {
      if (o.suspended) {
        return;
      }

      let value = null as T;
      signalsStack.push(o);

      try {
        value = fn();
      } catch (e) {
        console.error(e);
      } finally {
        signalsStack.pop();
      }

      if (!compare(o.internalValue, value)) {
        o.internalValue = value;
        notifyDependencies(o);
      }
    },
  };

  if (FF.debug) {
    Object.assign(o, { fn });
    refList.add(new WeakRef(o));
  }

  o.update();
  return o as Signal<T>;
}

function shallowRef<T>(value?: T) {
  return ref<T>(value, true);
}

function isRef(t: any): t is Signal {
  return Boolean(t && t[refTag]);
}

function suspend(s: Signal) {
  (s as SignalInternal).suspended = true;
}

function resume(s: Signal) {
  (s as SignalInternal).suspended = false;
  (s as SignalInternal).update(s.value);
}

export type WatchOptions = { immediate: boolean };

function watch(target: Signal, fn: AnyFunction, o?: WatchOptions ) {
  const memoized = memoizedWatcher(fn);
  const watchers = (target as SignalInternal).watchers;
  watchers.add(memoized);

  if (o?.immediate) {
    memoized(target.value);
  } else {
    schedule(() => memoized(target.value));
  }

  return () => {
    watchers.delete(memoized);
  };
}

function effect(fn: AnyFunction, effectFn: AnyFunction, o?: WatchOptions) {
  return watch(computed(fn), effectFn, o);
}

function hook<T>(initial: T, isShallow = false) {
  const $ = ref(initial, isShallow);
  const setter = (v: T) => $.value = v;
  return [$, setter] as const;
}

function notifyDependencies(target: SignalInternal) {
  const value = target.value;

  if (!target.dependencies.size || !target.watchers.size) return;

  for (const dep of target.dependencies) {
    if (dep.suspended) {
      target.dependencies.delete(dep);
    } else {
      dep.update();
    }
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

let timer: any;
const queue: any[] = [];

function schedule(fn: AnyFunction) {
  clearTimeout(timer);
  queue.push(fn);

  timer = setTimeout(() => {
    let n;
    while (n = queue.shift()) {
      n();
    }
  }, 5);
}

export { ref, computed, effect, watch, hook, reactive, unwrap, isRef, shallowRef, canBeObserved, suspend, resume };
