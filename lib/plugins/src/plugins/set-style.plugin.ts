import { setStyle } from "@li3/dom";
import { compileExpression, wrapTryCatch } from "@li3/scope";
import { watch, Plugins, RuntimeContext } from "@li3/runtime";
import { dashToCamelCase } from "./property-binding.plugin.js";

Plugins.use({
  attribute($el, node, attribute, expression) {
    if (attribute.startsWith("style-")) {
      const style = dashToCamelCase(attribute.replace("style-", ""));
      createStyleBinding($el, node, style, expression);
    }
  },
});

export function createStyleBinding(
  $el: RuntimeContext,
  element: Element,
  style: string,
  expression: string
): void {
  const fn = compileExpression($el, expression);

  watch(wrapTryCatch(expression, fn), (v: any) => setStyle(element, style, v));
}
