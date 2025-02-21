import { unref } from '@li3/reactive';
import type { RuntimeContext } from './types';
import { Plugins } from './plugin.js';

export class ComponentInstance {
  static extend(properties) {
    Object.assign(ComponentInstance.prototype, properties);
  }
}

export function createState($el: RuntimeContext): void {
  const baseState = new ComponentInstance();
  const componentState = Object.assign(baseState, $el.parent?.state || {}, $el.setup($el) || {});
  Object.assign(componentState, $el.props);

  Plugins.apply('setup', [$el, componentState]);
  $el.state = componentState;
  $el.stateKeys = Object.keys($el.state);

  defineViewGetters($el);
}

function defineViewGetters($el: RuntimeContext) {
  for (const key of $el.stateKeys) {
    Object.defineProperty($el.view, key, {
      configurable: false,
      get() {
        return unref($el.state[key]);
      },
      set() {
        throw new Error('State property is read-only');
      },
    });
  }
}
