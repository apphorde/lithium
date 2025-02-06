import type { AnyFunction, RuntimeContext } from "./types";
import { plugins } from "./plugin.js";
import { unref } from "@li3/reactive";

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

export class ComponentInstance {
  static extend(properties) {
    Object.assign(ComponentInstance.prototype, properties);
  }
}

export function createState($el: RuntimeContext): void {
  // TODO check if state keys and prop names have a conflict
  const baseState = new ComponentInstance();
  const componentState = Object.assign(baseState, $el.setup($el) || {});
  plugins.apply("setup", [$el, componentState]);

  const combinedState = { ...$el.props, ...componentState };
  $el.state = $el.reactive.watchDeep(combinedState);
  $el.stateKeys = Object.keys($el.state);

  if ($el.parent) {
    const keys = Object.keys($el.state);
    $el.state = fork($el.parent.state, $el.state, $el.reactive.check);
    $el.stateKeys = [...new Set(keys.concat($el.parent.stateKeys))];
  }

  Object.freeze($el.state);
  Object.freeze($el.stateKeys);

  for (const key of $el.stateKeys) {
    Object.defineProperty($el.view, key, {
      configurable: false,
      get() {
        return unref(combinedState[key]);
      },
      set() {
        throw new Error('Property is read-only');
      },
    });
  }
}
