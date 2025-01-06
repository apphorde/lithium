import { setAttribute, setProperty } from "../internal-api/dom.js";
import {
  compileExpression,
  wrapTryCatch,
} from "../internal-api/expressions.js";
import { plugins } from "../internal-api/plugin.js";
import { watch } from "../component-api/setup.js";
import { RuntimeInternals } from "../internal-api/types";

plugins.use({
  applyAttribute($el, node, attribute, value) {
    if (attribute.charAt(0) === ":") {
      createPropertyBinding($el, node, attribute.slice(1), value);
    }

    if (attribute.startsWith("bind-")) {
      createPropertyBinding(
        $el,
        node,
        dashToCamelCase(attribute.replace("bind-", "")),
        value
      );
    }

    if (attribute.startsWith("attr-")) {
      createAttributeBinding(
        $el,
        node,
        dashToCamelCase(attribute.replace("attr-", "")),
        value
      );
    }
  },
});

export function createPropertyBinding(
  $el: RuntimeInternals,
  element: Element,
  name: string,
  expression: string
): void {
  const fn = compileExpression($el, expression);
  watch(wrapTryCatch(expression, fn), (v: any) =>
    setProperty(element, name, v)
  );
}

export function createAttributeBinding(
  $el: RuntimeInternals,
  element: Element,
  name: string,
  expression: string
): void {
  const fn = compileExpression($el, expression);
  watch(wrapTryCatch(expression, fn), (v: any) =>
    setAttribute(element, name, v)
  );
}

const wellKnownProperties = {
  "base-url": "baseURL",
  "inner-html": "innerHTML",
};

function dashToUpperCase(s: string) {
  return s.slice(1).toUpperCase();
}

export function dashToCamelCase(s: string) {
  return (
    wellKnownProperties[s] || s.replace(/([-]{1}[a-z]{1})+/g, dashToUpperCase)
  );
}
