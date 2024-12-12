import { setProperty } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";

plugins.use({
  applyAttribute(_$el, node, attribute, value) {
    if (attribute.charAt(0) === ":" || attribute.startsWith("bind-")) {
      createPropertyBinding(node, attribute, value);
    }
  },
});

export function createPropertyBinding(
  el: any,
  attribute: string,
  expression: string
): void {
  const name = attribute.startsWith("@")
    ? attribute.slice(1)
    : dashToCamelCase(attribute.replace("bind-", ""));

  const fn = compileExpression(expression);

  watch(wrapTryCatch(expression, fn), (v: any) => setProperty(el, name, v));
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
