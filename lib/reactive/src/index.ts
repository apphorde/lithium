export * from "./reactive.js";
export * from "./ref.js";
import { reactive } from './reactive.js'

type TFunction<T> = (...args: any[]) => T;
export interface SignalInit<T> {
  value?: T;
  compute?: TFunction<T>;
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

function _signal<T>(init: { value: T }): Signal<T>;
function _signal<T>(init: { compute: TFunction<T> }): Effect<T>;
function _signal<T>(init: SignalInit<T>) {
  const dependencies = new Set<Function>();
  const shallow = !!init.shallow;
  let v = init.value;

  function check() {
    for (const f of dependencies) {
      if (disposed.has(f)) {
        dependencies.delete(f);
        continue;
      }

      f();
    }
  }

  if (!init.compute) {
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
        v = shallow ? newValue : reactive(newValue as object, check) as T;
        check();
      },
    } as Signal<T>;
  }

  const fn = init.compute;
  const callback = () => {
    v = fn();
    check();
  };

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

export function signal<T>(value: T, options?: Omit<SignalInit<T>, 'value' | 'computed'>) {
  return _signal<T>({ value, ...options });
}

export function effect<T>(compute: TFunction<T>, options?: Omit<SignalInit<T>, 'value' | 'computed'>) {
  return _signal<T>({ compute, ...options });
}

export function observer<T>(signal: Signal<T>, effect: TFunction<T>) {
  signal[$watch](effect);
}