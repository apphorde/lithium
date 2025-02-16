import type { Ref } from "@li3/reactive";
import { isElement, getAttribute } from "@li3/dom";
import { RuntimeContext } from "./types.js";
import { Plugins } from "./plugin.js";

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

  if (definition && definition.hasOwnProperty("default")) {
    if (typeof definition.default === "function") {
      return (definition.default as any)();
    }

    return definition.default;
  }
}

export function createInputRef<T = any>($el: RuntimeContext, name: string, initialValue?: T): Ref<T> {
  const $ref = $el.reactive.ref<T>(initialValue);

  if (!isElement($el.element)) {
    return $ref;
  }

  Object.defineProperty($el.element, name, {
    get() {
      return $ref.value;
    },
    set(value) {
      const oldValue = $ref.value;
      $ref.value = value;
      Plugins.apply("update", [$el, name, oldValue, value]);
      $el.update.forEach((f) => f($el, name, oldValue, value));
    },
  });

  return $ref;
}

export function syncProp($el: RuntimeContext, p: string, value: any) {
  if ($el.props[p] && $el.props[p].value !== value) {
    $el.reactive.suspend();
    $el.props[p].value = value;
    $el.reactive.unsuspend();
  }
}
