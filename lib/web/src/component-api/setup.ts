 import { getCurrentInstance } from "../internal-api/stack.js";
import { EventEmitFunction } from "../internal-api/types.js";
import { defineEventOnElement, isElement } from "../internal-api/dom.js";
import type { RuntimeInternals } from "../internal-api/types.js";


export function loadCss(url: string): void {
  getCurrentInstance().stylesheets.push(url);
}

export function loadScript(url: string): void {
  getCurrentInstance().scripts.push(url);
}

export function onInit(fn: VoidFunction): void {
  getCurrentInstance().init.push(fn);
}

export function onDestroy(fn: VoidFunction): void {
  getCurrentInstance().destroy.push(fn);
}

export function defineQuery(selector: string) {
  const $el = getCurrentInstance();
  const root = ($el.element as Element).shadowRoot || $el.element;

  return new Proxy(
    {},
    {
      get(_t, key) {
        if (key === "one") {
          return root.querySelector(selector);
        }

        if (key === "many") {
          return root.querySelectorAll(selector);
        }

        return null;
      },
    }
  );
}

export function defineEvents(eventNames: any): EventEmitFunction {
  const el = getCurrentInstance().element;

  if (isElement(el)) {
    for (const event of eventNames) {
      defineEventOnElement(el, event);
    }
  }

  return emitEvent.bind(null, el);
}

export function emitEvent(
  element: Element,
  eventName: string,
  detail: any
): void {
  const event = new CustomEvent(eventName, { detail });
  element.dispatchEvent(event);
}

export function defineProps(definitions: string[] | Record<string, any>): any {
  const $el = getCurrentInstance();
  const keys = !Array.isArray(definitions)
    ? Object.keys(definitions)
    : definitions;
  const { element, state } = $el;
  const props = {};

  for (const property of keys) {
    let initialValue = getPropValue($el, property, definitions[property]);

    const $ref = $el.reactive.ref(initialValue);
    state[property] = $ref;
    props[property] = $ref;

    if (!isElement(element)) {
      continue;
    }

    Object.defineProperty(element, property, {
      get() {
        return $ref.value;
      },
      set(value) {
        $ref.value = value;
      },
    });
  }

  return new Proxy(
    { __w: true },
    {
      get(_t, p) {
        if (p === "__w") return true;

        if (props[p]) {
          return props[p].value;
        }
      },
      set(_t, p, value) {
        if (props[p] && props[p].value !== value) {
          $el.reactive.suspend();
          props[p].value = value;
          $el.reactive.unsuspend();
        }

        return true;
      },
    }
  );
}

function getPropValue(
  $el: RuntimeInternals,
  property: string,
  definition: any
) {
  if ($el.props && property in $el.props) {
    return $el.props[property];
  }

  if ($el.element.hasOwnProperty(property)) {
    return $el.element[property];
  }

  if (
    isElement($el.element) &&
    $el.element.hasAttribute(property.toLowerCase())
  ) {
    return $el.element.getAttribute(property);
  }

  if (definition && definition.hasOwnProperty("default")) {
    if (typeof definition.default === "function") {
      return definition.default();
    }

    return definition.default;
  }
}
