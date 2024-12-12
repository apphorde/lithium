import { isElement, setClassName } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";

plugins.use({
  applyAttribute(_, node, attribute, value) {
    if (!isElement(node)) {
      return;
    }

    if (attribute.startsWith(".class.") || attribute.startsWith("class-")) {
      createElementNodeClassBinding(node, attribute, value);
    }
  },
});

export function createElementNodeClassBinding(
  el: any,
  attribute: string,
  expression: string
): void {
  const classNames = attribute.replace(".class.", "").replace("class-", "");
  const fn = compileExpression(expression);
  watch(wrapTryCatch(expression, fn), (v?: any) =>
    setClassName(el, classNames, v)
  );
}
