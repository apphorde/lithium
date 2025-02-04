export interface Ref<T> {
  value: T;
  __isRef: true;
}

type AnyFunction = (...args: any) => any;
const reactiveTag = "__w";

export interface ObservableContext {
  check: VoidFunction;
  suspended: boolean;
  observers: AnyFunction[];
}

export function check(target: ObservableContext): void {
  if (target.suspended) return;

  for (const w of target.observers) {
    w();
  }
}

export function observer<T>(valueGetter: Ref<T> | (() => T), effect: (value: T) => void): VoidFunction {
  let lastValue: T | undefined;

  return async function () {
    let value = isRef<T>(valueGetter) ? await unref(valueGetter) : unref(await valueGetter());

    if (value !== lastValue && !Number.isNaN(value)) {
      lastValue = value;
      effect(value);
    }
  };
}

export interface ReactiveOptions {
  shallow?: boolean
}

export function reactive<T extends object>(object: T, callback: VoidFunction, options?: ReactiveOptions): T {
  if (object === null || object === undefined || reactiveTag in object) {
    return object;
  }

  markAsReactive(object);

  if (!options?.shallow) {
    const values = Object.entries(object);
    for (const [key, next] of values) {
      if (typeof next === "object" && next !== null) {
        (object as any)[key] = reactive(next, callback);
      }
    }
  }

  return new Proxy(object, {
    set(target, p, value) {
      if ((target as any)[p] === value) {
        return false;
      }

      if (typeof value === "object" && value !== null && !options?.shallow) {
        value = reactive(value, callback, options);
      }

      (target as any)[p] = value;
      callback();
      return true;
    },
    deleteProperty(target, p) {
      delete target[p];
      callback();
      return true;
    }
  });
}

export function debounce(fn, timeout) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(fn, timeout, ...args);
  };
}

export interface RefOptions {
  debounce: number;
  shallow: boolean;
}

function refDebounce<T>(initialValue: T | null, options: RefOptions) {
  let v: T | null = unref(initialValue);
  const set = debounce((newValue) => (v = unref(newValue)), options.debounce);

  return {
    __isRef: true,
    get value() {
      return v;
    },
    set value(v) {
      set(v);
    },
  };
}

export function ref<T>(initialValue: T | null, effect: AnyFunction, options?: RefOptions): Ref<T> {
  if (options?.debounce) {
    return reactive(refDebounce(initialValue, options), effect, options) as Ref<T>;
  }

  return reactive(
    {
      __isRef: true,
      value: initialValue,
    },
    effect,
    options,
  ) as Ref<T>;
}

export function isRef<X>(t: any): t is Ref<X> {
  return typeof t !== "object" ? false : t && t.__isRef;
}

export function unref<T>(v: T | Ref<T>): T {
  return isRef(v) ? v.value : v;
}

export class ReactiveContext implements ObservableContext {
  public check: VoidFunction;
  public suspended = false;
  public observers: AnyFunction[] = [];

  constructor() {
    this.check = check.bind(null, this);
  }

  watch<T>(getter: Ref<T> | (() => T), effect?: AnyFunction): void {
    if (typeof getter !== "function" && !isRef(getter)) {
      throw new Error("Watched expression must be a function");
    }

    if (effect && typeof effect !== "function") {
      throw new Error("Watcher effect must be a function");
    }

    const fn = effect ? observer(getter, effect) : (isRef(getter) ? () => getter.value : getter);
    this.observers.push(fn);
  }

  ref<T>(initialValue: T | null, options?: RefOptions): Ref<T> {
    return ref(initialValue, this.check, options);
  }

  watchDeep<T extends object>(context: T, callback?: VoidFunction): T {
    return reactive(context, callback || this.check);
  }

  suspend(): void {
    this.suspended = true;
  }

  unsuspend(): void {
    this.suspended = false;
  }
}

export function markAsReactive(context: any): void {
  Object.defineProperty(context, reactiveTag, {
    value: true,
    enumerable: false,
    configurable: false,
  });
}
