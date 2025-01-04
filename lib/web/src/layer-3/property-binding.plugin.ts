import { setAttribute, setProperty } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";

plugins.use({
  applyAttribute(_$el, node, attribute, value) {
    if (attribute.charAt(0) === ":") {
      createPropertyBinding(node, attribute.slice(1), value);
    }

    if (attribute.startsWith("bind-")) {
      createPropertyBinding(
        node,
        dashToCamelCase(attribute.replace("bind-", "")),
        value
      );
    }

    if (attribute.startsWith("attr-")) {
      createAttributeBinding(
        node,
        dashToCamelCase(attribute.replace("attr-", "")),
        value
      );
    }
  },
});

export function createPropertyBinding(
  el: any,
  name: string,
  expression: string
): void {
  const fn = compileExpression(expression);
  watch(wrapTryCatch(expression, fn), (v: any) => setProperty(el, name, v));
}

export function createAttributeBinding(
  el: any,
  name: string,
  expression: string
): void {
  const fn = compileExpression(expression);
  watch(wrapTryCatch(expression, fn), (v: any) => setAttribute(el, name, v));
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
