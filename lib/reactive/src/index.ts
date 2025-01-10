const reactiveTag = Symbol("@react");
const refTag = Symbol("@ref");

interface AsyncVoidFunction {
  (): Promise<void>;
}

export interface ReactiveOptions {
  shallow?: boolean;
  observers?: VoidFunction[];
}

export interface ReactiveTarget {
  [reactiveTag]: VoidFunction[];
}

function setProperty(target: object, property: any, value: any, observers: VoidFunction[], shallow: boolean) {
  if (shallow) {
    target[property] = value;
  } else {
    target[property] =
      typeof value === "object" && value && !value[reactiveTag] ? reactive(value, { shallow, observers }) : value;
  }

  for (const o of observers) o();

  return true;
}

export function reactive<T extends Object>(target: T, options?: ReactiveOptions): T & ReactiveTarget {
  const observers = options?.observers || [];
  const shallow = !!options?.shallow;

  if (!shallow) {
    const entries = Object.entries(target);

    for (const [key, value] of entries) {
      if (typeof value === "object" && value) {
        target[key] = reactive(value, { observers, shallow: false });
      }
    }
  }

  const proxy = new Proxy(target, {
    set(t, p, v) {
      return setProperty(t, p, v, observers, shallow);
    },

    get(t, p) {
      if (p === reactiveTag) {
        return observers;
      }

      return t[p];
    },
  });

  return proxy as T & ReactiveTarget;
}

export function observe(target: ReactiveTarget, effect: VoidFunction): void {
  if (!target[reactiveTag]) {
    throw new Error("Target is not reactive");
  }

  target[reactiveTag].push(effect);
}

export interface Ref<T> extends ReactiveTarget {
  value: T;
}

function internalRef<T>(v: T | null | undefined, shallow: boolean): Ref<T> {
  const t = { value: v };
  Object.defineProperty(t, refTag, { value: true, configurable: false, enumerable: false, writable: false });
  return reactive(t, { shallow });
}

export function ref<T>(v: T | null | undefined): Ref<T> {
  return internalRef(v, false);
}

export function shallowRef<T>(v: T | null | undefined): Ref<T> {
  return internalRef(v, true);
}

export function isRef<T>(t: any): t is Ref<T> {
  return t && t[refTag] === true;
}

export function unref(t: any) {
  if (isRef(t)) {
    return t.value;
  }

  return t;
}

export function diffWatcher<T>(
  valueGetter: Ref<T> | (() => T),
  effect: (value: T, lastValue: T | undefined) => void
): AsyncVoidFunction {
  let lastValue: T | undefined;

  return async function () {
    let value = isRef<T>(valueGetter) ? await unref(valueGetter) : unref(await valueGetter());

    if (value !== lastValue && !Number.isNaN(value)) {
      effect(value, lastValue);
      lastValue = value;
    }
  };
}
