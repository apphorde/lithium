export * from "./reactive.js";
import { reactive } from './reactive.js'

type TFunction<T> = (...args: any[]) => T;
export interface SignalInit {
  shallow?: boolean;
}

export interface Signal<T> {
  readonly __isRef: true;
  value: T;
}

export interface Effect<T> {
  readonly __isRef: true;
  readonly value: T;
  dispose(): void;
}

let capture = false;
const effects = [Function.prototype];
const disposed = new WeakMap<Function, boolean>();
const $watch = Symbol('');

function makeSignal<T>(initialValue: T, isShallow: boolean): Signal<T> {
  const dependencies = new Set<Function>();
  let v: T = initialValue;

  return {
    [$watch]<T>(effect: TFunction<T>) {
      dependencies.add(effect);
    },
    get __isRef() {
      return true;
    },
    get value() {
      if (capture) {
        dependencies.add(effects.at(-1));
      }

      return v;
    },

    set value(newValue) {
      v = isShallow ? newValue : reactive(newValue as object, () => checkSignal(dependencies)) as T;
      checkSignal(dependencies);
    },
  } as Signal<T>;
}

export function effect<T>(fn: Function): Effect<T> {
  const dependencies = new Set<Function>();
  let v: T;

  function callback () {
    v = fn();
    checkSignal(dependencies);
  }

  effects.push(callback);
  capture = true;
  try {
    v = fn();
  } catch {}
  effects.pop();
  capture = false;

  return {
    [$watch]<T>(effect: TFunction<T>) {
      dependencies.add(effect);
    },
    get __isRef() {
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

function checkSignal(dependencies: Set<Function>) {
  for (const f of dependencies) {
    if (disposed.has(f)) {
      dependencies.delete(f);
    } else {
      f();
    }
  }
}

export function signal<T>(value: T, options?: SignalInit) {
  return makeSignal<T>(value, !!options.shallow);
}

export function observer<T>(signal: Signal<T>, effect: TFunction<T>) {
  signal[$watch](effect);
}

export function isRef<X = any>(t: any): t is Signal<X> {
  return typeof t !== 'object' ? false : t && t.__isRef;
}

export function unref<T>(v: T | Signal<T>): T {
  return isRef(v) ? v.value : v;
}