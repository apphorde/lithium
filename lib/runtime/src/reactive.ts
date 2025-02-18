import { unref } from '@li3/reactive';
import type { AnyFunction, RuntimeContext } from './types';
import { Plugins } from './plugin.js';

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
  Plugins.apply('setup', [$el, componentState]);

  $el.state = { ...$el.props, ...componentState };
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
