import { isElement } from "./dom.js";
import { getCurrentInstance } from "../layer-0/stack.js";
import type { RuntimeInternals } from "../layer-0/types.js";

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
