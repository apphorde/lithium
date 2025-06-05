import { setStyle } from "@li3/dom";
import { onVisitAttribute, type RuntimeContext } from "@li3/runtime";
import { computedEffect } from "@li3/scope";
import { dashToCamelCase } from "./property-binding.plugin.js";

onVisitAttribute(($el, node: Element, attribute, expression) => {
  if (attribute.startsWith("style-")) {
    const style = dashToCamelCase(attribute.replace("style-", ""));
    createStyleBinding($el, node, style, expression);
  }
});

export function createStyleBinding($el: RuntimeContext, element: Element, style: string, expression: string): void {
  computedEffect($el, expression, (v: any) => setStyle(element, style, v));
}
