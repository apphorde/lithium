type AnyFunction = (...args: any) => any;
const reactiveTag = '__w';

export interface Ref<T> {
  value: T;
  readonly __isRef: true;
  check(): void;
  watch(effect: AnyFunction): void;
}

export interface ReactiveOptions {
  shallow?: boolean;
}

export class ValueRef<T> implements Ref<T> {
  public readonly __isRef = true as true;
  private __value: T;
  private observers: AnyFunction[] = [];

  constructor(
    value: T,
    private options?: ReactiveOptions,
  ) {
    this.value = value;
  }

  get value(): T {
    if (ComputedRef.capturingDependency) {
      ComputedRef.dependencies.push(this);
    }

    return this.__value;
  }

  set value(newValue: T) {
    if (newValue === this.__value) {
      return;
    }

    if (this.options?.shallow || !canBeReactive(newValue)) {
      this.__value = newValue;
      this.check();
      return;
    }

    this.__value = reactive(newValue as object, () => this.check()) as T;
    this.check();
  }

  public check(): void {
    for (const fn of this.observers) {
      fn();
    }
  }

  public watch(effect: AnyFunction): void {
    this.observers.push(effect);
  }
}

export class ComputedRef<T> implements Ref<T> {
  public readonly __isRef = true as true;
  public value: T;

  static dependencies: ValueRef<any>[] = [];
  static capturingDependency: boolean = false;

  private observers: AnyFunction[] = [];

  constructor(
    protected getter: () => T,
    callback?: AnyFunction,
  ) {
    ComputedRef.capturingDependency = true;
    this.value = getter();
    ComputedRef.capturingDependency = false;

    const effect = () => this.update();
    for (const dep of ComputedRef.dependencies) {
      dep.watch(effect);
    }

    ComputedRef.dependencies = [];
    if (callback) {
      this.watch(callback);
      this.check();
    }
  }

  private update() {
    this.value = this.getter();
    this.check();
  }

  public check(): void {
    for (const fn of this.observers) {
      fn();
    }
  }

  public watch(effect: AnyFunction): void {
    this.observers.push(effect);
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
  const getter = isRef<T>(valueGetter) ? async () => await valueGetter.value : async () => unref(await valueGetter());

  return async function () {
    let value = await getter();

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
