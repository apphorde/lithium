export interface Ref<T> {
  value: T;
  __isRef: true;
}

type AnyFunction = (...args: any) => any;

export class Reactive {
  private watchers: AnyFunction[] = [];
  private suspended = false;

  constructor() {
    this.check = this.check.bind(this);
  }

  check(): void {
    if (this.suspended) return;

    for (const w of this.watchers) {
      w();
    }
  }

  watch<T>(exec: () => T, effect?: AnyFunction): void {
    let lastValue: T | undefined;
    let fn: AnyFunction;

    if (!effect) {
      fn = exec;
    } else {
      fn = function () {
        const value = exec();

        if (value !== lastValue && !Number.isNaN(value)) {
          lastValue = value;
          effect(value);
        }
      };
    }

    this.watchers.push(fn);
  }

  ref<T>(initialValue: T | undefined | null): Ref<T> {
    const target = { value: initialValue };

    Object.defineProperty(target, "__isRef", {
      value: true,
      enumerable: false,
      configurable: false,
    });
    Object.defineProperty(target, "toString", {
      value: function () {
        return String(this.value);
      },
      enumerable: false,
      configurable: false,
    });

    return this.watchDeep(target);
  }

  watchObject(context: any, callback?: VoidFunction): Ref<any> {
    if (context.__w) {
      return context;
    }

    callback ||= this.check;
    const scope = this;
    Object.defineProperty(context, "__w", {
      value: true,
      enumerable: false,
      configurable: false,
    });

    return new Proxy(context, {
      set(target, p, value) {
        if (typeof value === "object" && !value.__w) {
          value = scope.watchDeep(value, callback);
        }

        target[p] = value;
        callback();
        return true;
      },
    });
  }

  watchDeep(context: any, callback?: VoidFunction): Ref<any> {
    // wrapping HTML elements with proxies leads to sad panda
    if (context.__w || context instanceof HTMLElement) {
      return context;
    }

    callback ||= this.check;
    const values = Object.entries(context);

    for (const [key, next] of values) {
      if (typeof next === "object" && next !== null) {
        context[key] = this.watchObject(next, callback);
      }
    }

    return this.watchObject(context, callback);
  }

  suspend(): void {
    this.suspended = true;
  }

  unsuspend(): void {
    this.suspended = false;
  }

  static isRef<X>(t: any): t is Ref<X> {
    return typeof t !== "object" ? false : t && t.__isRef;
  }

  static unref<T>(v: T | Ref<T>): T {
    return Reactive.isRef(v) ? v.value : v;
  }
}
