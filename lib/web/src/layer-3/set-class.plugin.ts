import { setClassName } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";
import { RuntimeInternals } from "../layer-0/types";

plugins.use({
  applyAttribute($el, node, attribute, value) {
    if (attribute.startsWith(".class.") || attribute.startsWith("class-")) {
      createClassBinding(
        $el,
        node,
        attribute.replace(".class.", "").replace("class-", ""),
        value
      );
    }
  },
});

export function createClassBinding(
  $el: RuntimeInternals,
  element: Element,
  classNames: string,
  expression: string
): void {
  const fn = compileExpression($el, expression);

  watch(wrapTryCatch(expression, fn), (v?: any) =>
    setClassName(element, classNames, v)
  );
}
