import { setStyle } from "../internal-api/dom.js";
import { compileExpression, wrapTryCatch } from "../internal-api/expressions.js";
import { plugins } from "../internal-api/plugin.js";
import { watch } from "../component-api/setup.js";
import { RuntimeInternals } from "../internal-api/types";

plugins.use({
  applyAttribute($el, node, attribute, expression) {
    if (attribute.startsWith("style-")) {
      const style = attribute.replace("style-", "");
      createStyleBinding($el, node, style, expression);
    }
  },
});

export function createStyleBinding($el: RuntimeInternals, element: Element, style: string, expression: string): void {
  const fn = compileExpression($el, expression);

  watch(wrapTryCatch(expression, fn), (v: any) => setStyle(element, style, v));
}
