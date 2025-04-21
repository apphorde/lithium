import { type Signal } from '@li3/reactive';
import { isElement, getAttribute } from '@li3/dom';
import { RuntimeContext } from './types.js';
import { Plugins } from './plugin.js';

export type PropDefinition<T> = { type: Function; default: T | (() => T) };

export function getPropValue<T>($el: RuntimeContext, property: string, definition: PropDefinition<T>): T {
  if ($el.initialValues[property] !== undefined) {
    return $el.initialValues[property];
  }

  if ($el.element.hasOwnProperty(property)) {
    return $el.element[property];
  }

  const fromDom = getAttribute($el.element as Element, property.toLowerCase());
  if (fromDom) {
    // TODO typecast number/bool?
    return fromDom as T;
  }

  if (definition && definition.hasOwnProperty('default')) {
    if (typeof definition.default === 'function') {
      return (definition.default as any)();
    }

    return definition.default;
  }
}

export function triggerPropUpdate<T>($el: RuntimeContext, prop: string, oldValue: T | undefined, newValue: T | undefined) {
  Plugins.apply('update', [$el, prop, oldValue, newValue]);
  $el.update.forEach((f) => f($el, prop, oldValue, newValue));
}

export function createInputRef<T = any>($el: RuntimeContext, name: string, signal: Signal<T>): Signal<T> {
  if (!isElement($el.element)) {
    return;
  }

  Object.defineProperty($el.element, name, {
    get() {
      return signal.value;
    },
    set(value) {
      const oldValue = signal.value;
      signal.value = value;
      triggerPropUpdate($el, name, oldValue, value);
    },
  });
}
