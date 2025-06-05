import { setClassName } from "@li3/dom";
import { onVisitAttribute, type RuntimeContext } from "@li3/runtime";
import { computedEffect } from "@li3/scope";

onVisitAttribute(($el: RuntimeContext, node: Element, attribute, value) => {
  if (attribute.startsWith("class-")) {
    createClassBinding($el, node, attribute.replace("class-", ""), value);
  }
});

export function createClassBinding(
  $el: RuntimeContext,
  element: Element,
  classNames: string,
  expression: string,
): void {
  computedEffect($el, expression, (v?: any) => setClassName(element, classNames, v));
}
