type AnyFunction = (...args: any) => any;
const reactiveTag = Symbol('reactive');

/**
 * Ref is a type of object that can be watched for changes.
 * It has a .value property, which holds the current value.
 * It also has a .watch method, which adds an observer to its value.
 */
export interface Ref<T> {
  value: T;
  readonly __isRef: true;
  check(): void;
  watch(effect: AnyFunction): void;
  toString(): string;
  valueOf(): T;
}

export interface ReactiveOptions {
  shallow?: boolean;
}

const effects = [Function.prototype];
let capturingDependency = false;

function captureDependencies(target: ComputedRef<any>, callback?: AnyFunction) {
  capturingDependency = true;
  console.log('capture', effects);
  const effect = () => target.update();
  effects.push(effect);

  try {
    target.update();
  } catch {
    // ignore
  } finally {
    capturingDependency = false;
  }

  if (callback) {
    target.watch(callback);
    target.check();
  }
}

/**
 * ValueRef is a reactive reference that updates its value when it is set.
 * It is used to create reactive values that can be watched for changes.
 * @param value The initial value of the reference.
 * @param options An optional object with reactive options.
 * @returns A ValueRef instance.
 * @example
 *    const value = valueRef(1);
 *    value.watch((value) => console.log(value));
 *    value.value = 2; // logs 2
 */
export class ValueRef<T> implements Ref<T> {
  public readonly __isRef = true as true;
  #value: T;
  #observers: Function[] = [];

  constructor(
    value: T,
    private options?: ReactiveOptions,
  ) {
    this.#value = value;
  }

  get value(): T {
    if (capturingDependency) {
      this.#observers.push(effects.at(-1));
    }

    return this.#value;
  }

  set value(newValue: T) {
    if (newValue === this.#value) {
      return;
    }

    if (this.options?.shallow || !canBeReactive(newValue)) {
      this.#value = newValue;
      this.check();
      return;
    }

    this.#value = reactive(newValue as object, () => this.check()) as T;
    this.check();
  }

  /**
   * Triggers the observers.
   */
  public check(): void {
    for (const fn of this.#observers) {
      fn(this.value);
    }
  }

  /**
   * Adds an observer to the reactive value.
   * @param effect The observer function.
   */
  public watch(effect: AnyFunction): void {
    this.#observers.push(effect);
  }

  toString() {
    return String(this.value);
  }

  valueOf() {
    return this.value;
  }
}

/**
 * ComputedRef is a reactive reference that updates its value when its dependencies change.
 * It is used to create computed values that depend on other reactive values.
 *
 * @param getter A function that returns the computed value.
 * @param callback An optional callback that is called when the computed value changes.
 * @returns A ComputedRef instance.
 *
 * @example
 *    const source1 = valueRef(1);
 *    const source2 = valueRef(2);
 *    const computed = computedRef(() => source1.value + source2.value);
 *    computed.watch((value) => console.log(value));
 *    source1.value = 3; // logs 5
 *    source2.value = 3; // logs 6
 */
export class ComputedRef<T> implements Ref<T> {
  public readonly __isRef = true as true;
  #observers: Function[] = [];
  #value: T;

  /**
   * The computed value. It is updated when its dependencies change.
   * It can be accessed using the `value` property, but cannot be set directly.
   * @returns The computed value.
   */
  get value(): T {
    if (capturingDependency) {
      this.#observers.push(effects.at(-1));
    }

    return this.#value;
  }

  constructor(
    protected getter: () => T,
    callback?: AnyFunction,
  ) {
    captureDependencies(this, callback);
  }

  /**
   * Updates the computed value by calling the getter function.
   * It also triggers the observers with the new value.
   */
  update() {
    this.#value = this.getter();
    this.check();
  }

  /**
   * Triggers the observers.
   */
  public check(): void {
    for (const fn of this.#observers) {
      fn(this.value);
    }
  }

  /**
   * Adds an observer to the computed value.
   * @param effect The observer function.
   */
  public watch(effect: AnyFunction): void {
    this.#observers.push(effect);
  }

  toString() {
    return String(this.value);
  }

  valueOf() {
    return this.value;
  }
}

export function markAsReactive(context: any): void {
  Object.defineProperty(context, reactiveTag, {
    value: true,
    enumerable: false,
    configurable: false,
  });
}

export function watchValue<T>(valueGetter: Ref<T> | (() => T), effect: (value: T) => void): VoidFunction {
  let lastValue: T | undefined;
  const getter = isRef<T>(valueGetter) ? () => valueGetter.value : async () => unref(await valueGetter());

  return async function () {
    let value = (await getter()) as T;

    if (value !== lastValue && !Number.isNaN(value)) {
      lastValue = value;
      effect(value);
    }
  };
}

export function canBeReactive(object: any): boolean {
  return object !== null && object !== undefined && typeof object === 'object' && !object[reactiveTag];
}

export function reactive<T extends object>(object: T, effect: VoidFunction): T {
  if (!canBeReactive(object)) {
    return object;
  }

  markAsReactive(object);

  const values = Object.entries(object);
  for (const [key, next] of values) {
    if (typeof next === 'object' && next !== null) {
      (object as any)[key] = reactive(next, effect);
    }
  }

  return new Proxy(object, {
    set(target, p, value) {
      if ((target as any)[p] === value) {
        return false;
      }

      if (typeof value === 'object' && value !== null) {
        value = reactive(value, effect);
      }

      (target as any)[p] = value;
      effect();
      return true;
    },
    deleteProperty(target, p) {
      delete target[p];
      effect();
      return true;
    },
  });
}

export function computedRef<T>(getter: () => T, effect?: AnyFunction): Ref<T> {
  return new ComputedRef(getter, effect);
}

export function valueRef<T>(initialValue: T | null, effect?: AnyFunction, options?: ReactiveOptions): Ref<T> {
  const $ref = new ValueRef(initialValue, options);

  if (effect) {
    $ref.watch(effect);
  }

  return $ref;
}

export function isRef<X>(t: any): t is Ref<X> {
  return typeof t !== 'object' ? false : t && t.__isRef;
}

export function unref<T>(v: T | Ref<T>): T {
  return isRef(v) ? v.value : v;
}
