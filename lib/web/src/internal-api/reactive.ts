import type { AnyFunction, RuntimeContext } from "./types";
import { plugins } from "./plugin.js";

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

export function createState($el: RuntimeContext): void {
  // TODO check if state keys and prop names have a conflict
  const componentData = $el.setup($el, $el.element) || {};
  const combinedState = { ...$el.props, ...componentData };
  $el.state = $el.reactive.watchDeep(combinedState);
  $el.stateKeys = Object.keys($el.state);

  if ($el.parent) {
    const keys = Object.keys($el.state);
    $el.state = fork($el.parent.state, $el.state, $el.reactive.check);
    $el.stateKeys = [...new Set(keys.concat($el.parent.stateKeys))];
  }

  Object.freeze($el.state);
  Object.freeze($el.stateKeys);

  plugins.apply("setup", [$el]);
}
