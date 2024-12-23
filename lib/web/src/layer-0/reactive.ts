import { getCurrentInstance } from "./stack";
import type { AnyFunction, RuntimeInternals } from "./types";
import type { Ref } from "@lithium/reactive";

export { Ref, unref, isRef } from "@lithium/reactive";

export function watch(expression: AnyFunction, effect?: AnyFunction): void {
  return getCurrentInstance().reactive.watch(expression, effect);
}

export function computed<T>(fn: () => T): Ref<T> {
  const $ref = ref<T>(null, { shallow: true });
  watch(() => {
    const v = fn();
    if ($ref.value !== v) {
      $ref.value = v;
    }
  });

  return $ref;
}

export function ref<T>(value?: T, options?): Ref<T> {
  return getCurrentInstance().reactive.ref(value, options);
}

export function shallowRef<T>(value?: T, options = {}): Ref<T> {
  return ref(value, { ...options, shallow: true });
}

export function fork(parent: any, child: any, callback: AnyFunction) {
  return new Proxy(child, {
    get(_t, p) {
      if (child[p] !== undefined) {
        return child[p];
      }

      return parent[p];
    },
    set(_t, p, v) {
      if (child.hasOwnProperty(p)) {
        child[p] = v;
      } else {
        parent[p] = v;
      }

      callback();
      return true;
    },
  });
}

export function createState($el: RuntimeInternals): void {
  $el ||= getCurrentInstance();
  const componentData = $el.setup($el, $el.element) || {};
  $el.state = $el.reactive.watchDeep({ ...componentData, ...$el.state });
  $el.stateKeys = Object.keys($el.state);

  if ($el.parent) {
    const keys = Object.keys($el.state);
    $el.state = fork($el.parent.state, $el.state, $el.reactive.check);
    // TODO unique keys
    $el.stateKeys = keys.concat($el.parent.stateKeys);
  }

  Object.freeze($el.state);
  Object.freeze($el.stateKeys);
}
