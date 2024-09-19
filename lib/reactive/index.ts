export interface Ref<T> {
  value: T;
  __isRef: true;
}

type AnyFunction = (...args: any) => any;
const watchedObject = "__w";

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

export function watchValue<T>(
  valueGetter: () => T,
  effect: (value: T) => void
): VoidFunction {
  let lastValue: T | undefined;

  return function () {
    const value = valueGetter();

    if (value !== lastValue && !Number.isNaN(value)) {
      lastValue = value;
      effect(value);
    }
  };
}

export function reactive<T extends object>(
  object: T,
  callback: VoidFunction
): T {
  // wrapping HTML elements with proxies leads to sad panda
  if (
    (object === null && object !== undefined) ||
    watchedObject in object ||
    isElement(object)
  ) {
    return object;
  }

  markAsReactive(object);

  const values = Object.entries(object);
  for (const [key, next] of values) {
    if (typeof next === "object" && next !== null) {
      (<any>object)[key] = reactive(next, callback);
    }
  }

  return new Proxy(object, {
    set(target, p, value) {
      if (typeof value === "object" && value !== null) {
        value = reactive(value, callback);
      }

      (<any>target)[p] = value;
      callback();
      return true;
    },
  });
}

export interface RefOptions {
  debounce: number;
}

function refDebounce<T>(initialValue: T | null, options: RefOptions) {
  let v: T | null = initialValue;
  const set = debounce((newValue) => (v = newValue), options.debounce);

  return {
    __isRef: true,
    get value() {
      return v;
    },
    set value(v) {
      return set(v);
    },
    toString() {
      return String(this.value);
    },
  };
}

export function ref<T>(
  initialValue: T | null,
  effect: AnyFunction,
  options?: RefOptions
): Ref<T> {
  if (options?.debounce) {
    return reactive(refDebounce(initialValue, options), effect) as Ref<T>;
  }

  return reactive(
    {
      __isRef: true,
      value: initialValue,
      toString() {
        return String(this.value);
      },
    },
    effect
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

  watch<T>(getter: () => T, effect?: AnyFunction): void {
    if (typeof getter !== "function") {
      throw new Error("Watched expression must be a function");
    }

    if (effect && typeof getter !== "function") {
      throw new Error("Watcher effect must be a function");
    }

    this.observers.push(effect ? watchValue(getter, effect) : getter);
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

function markAsReactive(context: any): void {
  Object.defineProperty(context, watchedObject, {
    value: true,
    enumerable: false,
    configurable: false,
  });
}

function isElement(t: any): boolean {
  return t instanceof Element;
}
