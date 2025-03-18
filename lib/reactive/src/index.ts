export * from './reactive.js';
export * from './ref.js';

type TFunction<T> = (...args: any[]) => T;
interface SignalInit<T> {
  value?: T;
  compute?: TFunction<T>;
}

interface Signal<T> {
  value: T;
}

interface Effect<T> {
  readonly value: T;
  dispose(): void;
}

let capture = false;
const effects = [Function.prototype];
const disposed = new WeakMap<Function, boolean>();

function _signal<T>(init: { value: T }): Signal<T>;
function _signal<T>(init: { compute: TFunction<T> }): Effect<T>;
function _signal<T>(init: SignalInit<T>) {
  const dependencies = new Set<Function>();
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
      get value() {
        if (capture) {
          dependencies.add(effects.at(-1));
        }

        return v;
      },

      set value(newValue) {
        v = newValue;
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

export function signal<T>(value: T) {
  return _signal<T>({ value });
}

export function effect<T>(compute: TFunction<T>) {
  return _signal<T>({ compute });
}
