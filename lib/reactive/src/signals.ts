import { reactive } from "./reactive.js";

const $ref = Symbol("ref");

type TFunction<T> = (...args: any[]) => T;
export interface SignalInit {
  shallow?: boolean;
}

export interface Signal<T> {
  readonly [$ref]: true;
  value: T;
  watch(fn: TFunction<T>): void;
}

export interface Effect<T> {
  readonly [$ref]: true;
  readonly readonly: true;
  readonly value: T;
  watch(fn: TFunction<T>): void;
  dispose(): void;
}

let capture = false;
const effects = [Function.prototype];
const disposed = new WeakMap<Function, boolean>();

export function signal<T>(initialValue: T, options?: SignalInit): Signal<T> {
  const dependencies = new Set<Function>();
  const isShallow = !!options?.shallow;
  let v: T = initialValue;

  if (!isShallow && typeof v === "object" && v !== null) {
    v = reactive(v as object, () => checkSignal(dependencies, v)) as T;
  }

  return {
    watch<T>(effect: TFunction<T>) {
      dependencies.add(effect);
    },
    get [$ref]() {
      return true;
    },
    get value() {
      if (capture) {
        dependencies.add(effects.at(-1) as Function);
      }

      return v;
    },
    set value(newValue) {
      if (!isShallow && typeof newValue === "object" && newValue !== null) {
        newValue = reactive(newValue as object, () => checkSignal(dependencies, v)) as T;
      }

      if (v !== newValue) {
        v = newValue;
        checkSignal(dependencies, v);
      }
    },
  } as Signal<T>;
}

export function effect<T>(fn: TFunction<T>): Effect<T> {
  const dependencies = new Set<Function>();
  let v: T;

  function callback() {
    v = fn();
    checkSignal(dependencies, v);
  }

  effects.push(callback);
  capture = true;
  try {
    v = fn();
  } catch {}
  effects.pop();
  capture = false;

  return {
    watch<T>(effect: TFunction<T>) {
      dependencies.add(effect);
    },
    get [$ref]() {
      return true;
    },
    get readonly() {
      return true;
    },
    get value() {
      if (capture) {
        dependencies.add(effects.at(-1));
      }
      return v;
    },
    dispose() {
      disposed.set(callback, true);
    },
  } as Effect<T>;
}

function checkSignal<T>(dependencies: Set<Function>, v: T): void {
  for (const f of dependencies) {
    if (disposed.has(f)) {
      dependencies.delete(f);
    } else {
      f(v);
    }
  }
}

export function observer<T>(signal: Signal<T>, effect: TFunction<T>) {
  signal.watch(effect);
}

export function isRef<X = any>(t: any): t is Signal<X> | Effect<X> {
  return typeof t !== "object" ? false : t && t[$ref];
}

export function unref<T>(v: T | Signal<T>): T {
  return isRef(v) ? v.value : v;
}

export function isSignal<T>(t: any): t is Signal<T> {
  return isRef(t) && !t["readonly"];
}

export function isEffect<T>(t: any): t is Effect<T> {
  return isRef(t) && t["readonly"];
}
