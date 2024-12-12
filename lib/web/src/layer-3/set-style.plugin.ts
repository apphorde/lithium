import { isElement, setStyle } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";

plugins.use({
  applyAttribute(_, node, attribute, expression) {
    if (attribute.startsWith(".style.") || attribute.startsWith("style-")) {
      const style = attribute.replace(".style.", "").replace("style-", "");
      createStyleBinding(node, style, expression);
    }
  },
});

export function createStyleBinding(
  el: any,
  style: string,
  expression: string
): void {
  const fn = compileExpression(expression);

  watch(wrapTryCatch(expression, fn), (v: any) => setStyle(el, style, v));
}
