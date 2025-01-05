import { setStyle } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";
import { RuntimeInternals } from "../layer-0/types";

plugins.use({
  applyAttribute($el, node, attribute, expression) {
    if (attribute.startsWith(".style.") || attribute.startsWith("style-")) {
      const style = attribute.replace(".style.", "").replace("style-", "");
      createStyleBinding($el, node, style, expression);
    }
  },
});

export function createStyleBinding(
  $el: RuntimeInternals,
  element: Element,
  style: string,
  expression: string
): void {
  const fn = compileExpression($el, expression);

  watch(wrapTryCatch(expression, fn), (v: any) => setStyle(element, style, v));
}
