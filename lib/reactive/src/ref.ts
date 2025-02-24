import { canBeReactive, reactive } from './reactive.js';

type AnyFunction = (...args: any) => any;
const effects = [];
const sideEffects = Symbol();
const disposed = new WeakSet();

export interface ReactiveOptions {
  shallow?: boolean;
}

/**
 * A Signal is an object that holds a value.
 * Changes to that value can trigger side-effects.
 *
 * @param value The initial value of the reference.
 * @param options An optional object with reactive options.
 * @returns A ValueRef instance.
 * @example
 *    const value = valueRef(1);
 *    value.watch((value) => console.log(value));
 *    value.value = 2; // logs 2
 */
export class Signal<T> implements Ref<T> {
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
    if (effects.length) {
      this.#observers.push(effects.at(0));
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
      if (disposed.has(fn)) {
        this.#observers = this.#observers.filter((f) => f !== fn);
      } else {
        fn(this.value);
      }
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

export function valueRef<T>(initialValue: T | null, effect?: AnyFunction, options?: ReactiveOptions): Ref<T> {
  const $ref = new Signal(initialValue, options);

  if (effect) {
    $ref.watch(effect);
    effect($ref.value);
  }

  return $ref;
}

export function computedRef<T>(getter: () => T, effect?: AnyFunction): Ref<T> {
  try {
    const fn = () => ($ref.value = getter());
    effects.push(fn);
    const $ref = new Signal(getter());
    effects.pop();

    if (effect) {
      $ref.watch(effect);
      effect($ref.value);
    }

    $ref[sideEffects] = [effect, fn];
    return $ref;
  } catch (e) {}
}

export function detach(ref: Ref<any>) {
  if (!ref[sideEffects]) {
    return;
  }

  for (const fn of ref[sideEffects]) {
    disposed.add(fn);
  }
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

export function isRef<X = any>(t: any): t is Ref<X> {
  return typeof t !== 'object' ? false : t && t.__isRef;
}

export function unref<T>(v: T | Ref<T>): T {
  return isRef(v) ? v.value : v;
}

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
