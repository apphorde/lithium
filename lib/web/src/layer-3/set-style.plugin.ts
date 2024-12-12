import { isElement, setStyle } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";

plugins.use({
  applyAttribute(_, node, attribute, value) {
    if (!isElement(node)) {
      return;
    }

    if (attribute.startsWith(".class.") || attribute.startsWith("class-")) {
      createStyleBinding(node, attribute, value);
    }
  },
});

export function createStyleBinding(
  el: any,
  attribute: string,
  expression: string
): void {
  const style = attribute.replace(".style.", "").replace("style-", "");
  const fn = compileExpression(expression);

  watch(wrapTryCatch(expression, fn), (v: any) => setStyle(el, style, v));
}
