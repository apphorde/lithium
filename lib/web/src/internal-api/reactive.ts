import type { AnyFunction, RuntimeInternals } from "./types";

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
