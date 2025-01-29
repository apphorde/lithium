import { isElement } from "./dom.js";
import { RuntimeInternals } from "./types.js";

export function getPropValue($el: RuntimeInternals, property: string, definition: any) {
  if ($el.initialValues?.[property] !== undefined) {
    return $el.initialValues[property];
  }

  if ($el.element.hasOwnProperty(property)) {
    return $el.element[property];
  }

  if (isElement($el.element) && $el.element.hasAttribute(property.toLowerCase())) {
    return $el.element.getAttribute(property.toLowerCase());
  }

  if (definition && definition.hasOwnProperty("default")) {
    if (typeof definition.default === "function") {
      return definition.default();
    }

    return definition.default;
  }
}
